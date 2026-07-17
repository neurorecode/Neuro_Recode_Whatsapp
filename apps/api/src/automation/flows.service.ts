import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationSenderService } from './automation-sender.service';
import type { InboundTextEvent } from './automation.service';
import { Contact, FlowRun, Prisma } from '@nrw/db';

/** A node in the authored flow graph. */
interface FlowNode {
  id: string;
  type:
    | 'message'
    | 'buttons'
    | 'list'
    | 'question'
    | 'condition'
    | 'delay'
    | 'tag'
    | 'template'
    | 'handoff'
    | 'end';
  data: any;
  next?: string | null;
}

interface FlowGraph {
  nodes: FlowNode[];
}

export interface FlowInput {
  name: string;
  enabled?: boolean;
  trigger?: string; // keyword | first_contact | manual
  keywords?: string[];
  graph: FlowGraph;
  startNodeId?: string | null;
}

const MAX_STEPS = 30; // loop guard against cyclic graphs with no wait

@Injectable()
export class FlowsService {
  private readonly logger = new Logger(FlowsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: AutomationSenderService,
  ) {}

  // ---- CRUD ----
  list() {
    return this.prisma.flow.findMany({ orderBy: { createdAt: 'desc' } });
  }
  get(id: string) {
    return this.prisma.flow.findUnique({ where: { id } });
  }
  create(input: FlowInput) {
    return this.prisma.flow.create({
      data: {
        name: input.name,
        enabled: input.enabled ?? false,
        trigger: input.trigger ?? 'keyword',
        keywords: input.keywords ?? [],
        graph: input.graph as unknown as Prisma.InputJsonValue,
        startNodeId: input.startNodeId ?? null,
      },
    });
  }
  update(id: string, input: FlowInput) {
    return this.prisma.flow.update({
      where: { id },
      data: {
        name: input.name,
        enabled: input.enabled,
        trigger: input.trigger,
        keywords: input.keywords ?? [],
        graph: input.graph as unknown as Prisma.InputJsonValue,
        startNodeId: input.startNodeId ?? null,
      },
    });
  }
  setEnabled(id: string, enabled: boolean) {
    return this.prisma.flow.update({ where: { id }, data: { enabled } });
  }
  remove(id: string) {
    return this.prisma.flow.delete({ where: { id } });
  }

  // ---- Runtime entry: called by the automation orchestrator ----
  /** Returns true if a flow started or an active run consumed this inbound. */
  async tryHandle(payload: InboundTextEvent): Promise<boolean> {
    const run = await this.prisma.flowRun.findFirst({
      where: { conversationId: payload.conversationId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (run) {
      await this.resume(run, payload).catch((e) =>
        this.logger.warn(`flow resume failed: ${e?.message}`),
      );
      return true;
    }
    return this.tryStart(payload).catch((e) => {
      this.logger.warn(`flow start failed: ${e?.message}`);
      return false;
    });
  }

  private async tryStart(payload: InboundTextEvent): Promise<boolean> {
    const body = (payload.text || '').trim().toLowerCase();
    const flows = await this.prisma.flow.findMany({
      where: { enabled: true, trigger: { in: ['keyword', 'first_contact'] } },
    });
    const flow = flows.find((f) => {
      if (f.trigger === 'first_contact') return payload.isNewContact;
      return f.keywords.some((k) => k.trim() && body.includes(k.trim().toLowerCase()));
    });
    if (!flow || !flow.startNodeId) return false;

    const contact = await this.prisma.contact.findUnique({ where: { id: payload.contactId } });
    if (!contact) return false;

    const run = await this.prisma.flowRun.create({
      data: {
        flowId: flow.id,
        conversationId: payload.conversationId,
        contactId: payload.contactId,
        currentNodeId: flow.startNodeId,
        status: 'active',
        vars: {},
      },
    });
    await this.advance(run, flow.graph as unknown as FlowGraph, contact);
    return true;
  }

  private async resume(run: FlowRun, payload: InboundTextEvent): Promise<void> {
    const flow = await this.prisma.flow.findUnique({ where: { id: run.flowId } });
    if (!flow) return;
    const graph = flow.graph as unknown as FlowGraph;
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const contact = await this.prisma.contact.findUnique({ where: { id: run.contactId } });
    if (!contact) return;

    const node = run.currentNodeId ? nodes.get(run.currentNodeId) : undefined;
    if (!node) {
      await this.complete(run.id, 'completed');
      return;
    }

    const vars = (run.vars as Record<string, string>) ?? {};
    let nextId: string | null | undefined;

    if (node.type === 'buttons' || node.type === 'list') {
      const options: { id: string; next?: string | null }[] = node.data?.options ?? [];
      const chosen =
        options.find((o) => o.id === payload.replyId) ??
        options.find((o) => o.id === (payload.text || '').trim());
      if (!chosen) {
        // No recognizable choice — re-prompt the same node.
        await this.executeInteractive(node, contact);
        return;
      }
      nextId = chosen.next;
    } else if (node.type === 'question') {
      if (node.data?.varName) vars[node.data.varName] = payload.text ?? '';
      await this.prisma.flowRun.update({ where: { id: run.id }, data: { vars } });
      nextId = node.next;
    } else {
      nextId = node.next;
    }

    const updated = await this.prisma.flowRun.update({
      where: { id: run.id },
      data: { currentNodeId: nextId ?? null },
    });
    await this.advance(updated, graph, contact);
  }

  /** Resume runs parked on a delay node whose timer has elapsed (scheduler tick). */
  async runDueDelays(): Promise<void> {
    const due = await this.prisma.flowRun.findMany({
      where: { status: 'active', resumeAt: { lte: new Date() } },
      take: 100,
    });
    for (const run of due) {
      const flow = await this.prisma.flow.findUnique({ where: { id: run.flowId } });
      const contact = await this.prisma.contact.findUnique({ where: { id: run.contactId } });
      if (!flow || !contact) {
        await this.complete(run.id, 'ended');
        continue;
      }
      const graph = flow.graph as unknown as FlowGraph;
      const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
      const node = run.currentNodeId ? nodes.get(run.currentNodeId) : undefined;
      const nextId = node?.next ?? null;
      const updated = await this.prisma.flowRun.update({
        where: { id: run.id },
        data: { currentNodeId: nextId, resumeAt: null },
      });
      await this.advance(updated, graph, contact).catch((e) =>
        this.logger.warn(`flow delay resume failed: ${e?.message}`),
      );
    }
  }

  // ---- Core walker ----
  private async advance(run: FlowRun, graph: FlowGraph, contact: Contact): Promise<void> {
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    let currentId: string | null | undefined = run.currentNodeId;
    const vars = (run.vars as Record<string, string>) ?? {};

    for (let i = 0; i < MAX_STEPS; i++) {
      if (!currentId) return this.complete(run.id, 'completed');
      const node = nodes.get(currentId);
      if (!node) return this.complete(run.id, 'completed');

      switch (node.type) {
        case 'message':
          if (node.data?.text) await this.sender.sendText(contact, node.data.text);
          currentId = node.next;
          break;

        case 'template': {
          const template = await this.prisma.template.findUnique({
            where: { id: node.data?.templateId },
          });
          if (template && template.status === 'approved') {
            await this.sender.sendTemplate(contact, template, node.data?.bodyParams ?? []);
          }
          currentId = node.next;
          break;
        }

        case 'tag':
          if (node.data?.tag) {
            const tag = String(node.data.tag);
            if (!contact.tags.includes(tag)) {
              await this.prisma.contact.update({
                where: { id: contact.id },
                data: { tags: { push: tag } },
              });
              contact.tags.push(tag);
            }
          }
          currentId = node.next;
          break;

        case 'condition': {
          const val = vars[node.data?.varName] ?? '';
          const cases: { value: string; next?: string | null }[] = node.data?.cases ?? [];
          const hit = cases.find((c) => String(c.value).toLowerCase() === val.toLowerCase());
          currentId = hit?.next ?? node.data?.defaultNext ?? null;
          break;
        }

        case 'delay': {
          const minutes = Number(node.data?.minutes ?? 60);
          await this.prisma.flowRun.update({
            where: { id: run.id },
            data: { currentNodeId: node.id, resumeAt: new Date(Date.now() + minutes * 60_000) },
          });
          return; // scheduler resumes
        }

        case 'buttons':
        case 'list':
          await this.executeInteractive(node, contact);
          await this.prisma.flowRun.update({
            where: { id: run.id },
            data: { currentNodeId: node.id }, // park here, await reply
          });
          return;

        case 'question':
          if (node.data?.text) await this.sender.sendText(contact, node.data.text);
          await this.prisma.flowRun.update({
            where: { id: run.id },
            data: { currentNodeId: node.id },
          });
          return;

        case 'handoff':
          await this.prisma.conversation.update({
            where: { id: run.conversationId },
            data: { status: 'pending' },
          });
          if (node.data?.text) await this.sender.sendText(contact, node.data.text);
          return this.complete(run.id, 'ended');

        case 'end':
        default:
          return this.complete(run.id, 'completed');
      }
    }
    this.logger.warn(`flow ${run.flowId} hit step cap — ending run ${run.id}`);
    await this.complete(run.id, 'ended');
  }

  private async executeInteractive(node: FlowNode, contact: Contact): Promise<void> {
    const options: { id: string; title: string; description?: string }[] = node.data?.options ?? [];
    const text = node.data?.text ?? '';
    if (node.type === 'list') {
      await this.sender.sendList(
        contact,
        text,
        node.data?.buttonText ?? 'Choose',
        options.map((o) => ({ id: o.id, title: o.title, description: o.description })),
      );
    } else {
      await this.sender.sendButtons(
        contact,
        text,
        options.slice(0, 3).map((o) => ({ id: o.id, title: o.title })),
      );
    }
  }

  private async complete(id: string, status: 'completed' | 'ended'): Promise<void> {
    await this.prisma.flowRun.update({
      where: { id },
      data: { status, currentNodeId: null, resumeAt: null },
    });
  }
}
