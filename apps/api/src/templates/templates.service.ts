import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TemplateCategory, TemplateStatus, Prisma } from '@nrw/db';

export interface TemplateDto {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string | null;
  bodyVarCount: number;
}

function mapCategory(c: string): TemplateCategory {
  switch ((c || '').toUpperCase()) {
    case 'MARKETING':
      return 'marketing';
    case 'AUTHENTICATION':
      return 'authentication';
    default:
      return 'utility';
  }
}

function mapStatus(s: string): TemplateStatus {
  switch ((s || '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'PAUSED':
      return 'paused';
    case 'DISABLED':
      return 'disabled';
    default:
      return 'pending';
  }
}

/** Extract the BODY component text and count of {{n}} variables. */
export function parseBody(components: unknown): { bodyText: string | null; bodyVarCount: number } {
  const arr = Array.isArray(components) ? components : [];
  const body = arr.find((c: any) => c?.type === 'BODY');
  const text: string | null = body?.text ?? null;
  const matches = text ? text.match(/\{\{\s*\d+\s*\}\}/g) : null;
  return { bodyText: text, bodyVarCount: matches ? new Set(matches).size : 0 };
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /** Pull templates from the Graph API and upsert them into our DB. */
  async sync(): Promise<TemplateDto[]> {
    const remote = await this.whatsapp.listTemplates();
    for (const t of remote) {
      const components = (t.components ?? []) as Prisma.InputJsonValue;
      await this.prisma.template.upsert({
        where: { name_language: { name: t.name, language: t.language } },
        create: {
          name: t.name,
          language: t.language,
          category: mapCategory(t.category),
          status: mapStatus(t.status),
          components,
        },
        update: {
          category: mapCategory(t.category),
          status: mapStatus(t.status),
          components,
        },
      });
    }
    this.logger.log(`Synced ${remote.length} templates from Meta`);
    return this.list();
  }

  async list(): Promise<TemplateDto[]> {
    const rows = await this.prisma.template.findMany({ orderBy: [{ name: 'asc' }] });
    return rows.map((t) => {
      const { bodyText, bodyVarCount } = parseBody(t.components);
      return {
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        bodyText,
        bodyVarCount,
      };
    });
  }
}
