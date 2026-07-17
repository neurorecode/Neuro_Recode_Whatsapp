import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SequencesService } from './sequences.service';
import { FlowsService } from './flows.service';
import { BroadcastsService } from '../broadcasts/broadcasts.service';

/**
 * Runs every minute: fires any broadcasts whose scheduled time has arrived and
 * advances any drip-sequence enrollments whose next step is due.
 */
@Injectable()
export class AutomationSchedulerService {
  private readonly logger = new Logger(AutomationSchedulerService.name);
  private running = false;

  constructor(
    private readonly sequences: SequencesService,
    private readonly flows: FlowsService,
    private readonly broadcasts: BroadcastsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) return; // never overlap ticks
    this.running = true;
    try {
      await this.broadcasts.fireDueScheduled();
      await this.sequences.runDueSteps();
      await this.flows.runDueDelays();
    } catch (e: any) {
      this.logger.warn(`scheduler tick failed: ${e?.message}`);
    } finally {
      this.running = false;
    }
  }
}
