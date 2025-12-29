import cron from 'node-cron';
import { db } from '@unifiedstay/database';
import { iCalAdapter } from '../adapters/ical.adapter.js';

interface SyncResult {
  channelId: string;
  propertyName: string;
  channel: string;
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  error?: string;
}

class SyncScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private lastResults: SyncResult[] = [];

  /**
   * Start the automatic sync scheduler
   * Runs every 30 minutes by default
   */
  start(cronExpression = '*/30 * * * *') {
    if (this.task) {
      console.log('[SyncScheduler] Already running');
      return;
    }

    console.log('[SyncScheduler] Starting automatic sync (every 30 minutes)');

    this.task = cron.schedule(cronExpression, async () => {
      await this.runSync();
    });

    // Run initial sync after 10 seconds (give server time to fully start)
    setTimeout(() => {
      console.log('[SyncScheduler] Running initial sync...');
      this.runSync();
    }, 10000);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[SyncScheduler] Stopped');
    }
  }

  /**
   * Run sync for all channel mappings
   */
  async runSync(): Promise<SyncResult[]> {
    if (this.isRunning) {
      console.log('[SyncScheduler] Sync already in progress, skipping');
      return this.lastResults;
    }

    this.isRunning = true;
    this.lastRunAt = new Date();
    const results: SyncResult[] = [];

    try {
      console.log('[SyncScheduler] Starting sync for all channels...');

      // Get all channel mappings with iCal URLs
      const channelMappings = await db.channelMapping.findMany({
        where: {
          iCalUrl: { not: null },
        },
        include: {
          property: {
            include: {
              units: true,
            },
          },
        },
      });

      console.log(`[SyncScheduler] Found ${channelMappings.length} channels to sync`);

      for (const mapping of channelMappings) {
        const unit = mapping.property.units[0];
        if (!unit) {
          results.push({
            channelId: mapping.id,
            propertyName: mapping.property.name,
            channel: mapping.channel,
            success: false,
            eventsAdded: 0,
            eventsUpdated: 0,
            error: 'No unit found for property',
          });
          continue;
        }

        try {
          const syncResult = await iCalAdapter.syncCalendar(mapping, unit.id);

          // Update last sync time
          await db.channelMapping.update({
            where: { id: mapping.id },
            data: {
              lastSyncAt: new Date(),
              lastSyncError: syncResult.error || null,
            },
          });

          results.push({
            channelId: mapping.id,
            propertyName: mapping.property.name,
            channel: mapping.channel,
            success: !syncResult.error,
            eventsAdded: syncResult.added,
            eventsUpdated: syncResult.updated,
            error: syncResult.error,
          });

          console.log(
            `[SyncScheduler] Synced ${mapping.property.name} (${mapping.channel}): +${syncResult.added} events`
          );
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          
          await db.channelMapping.update({
            where: { id: mapping.id },
            data: {
              lastSyncError: errorMessage,
            },
          });

          results.push({
            channelId: mapping.id,
            propertyName: mapping.property.name,
            channel: mapping.channel,
            success: false,
            eventsAdded: 0,
            eventsUpdated: 0,
            error: errorMessage,
          });

          console.error(`[SyncScheduler] Error syncing ${mapping.property.name}:`, errorMessage);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      console.log(
        `[SyncScheduler] Sync complete: ${successCount}/${results.length} channels synced successfully`
      );
    } catch (err) {
      console.error('[SyncScheduler] Fatal error during sync:', err);
    } finally {
      this.isRunning = false;
      this.lastResults = results;
    }

    return results;
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastResults: this.lastResults,
      nextRunAt: this.task ? this.getNextRunTime() : null,
    };
  }

  private getNextRunTime(): Date | null {
    if (!this.lastRunAt) return null;
    // Next run is 30 minutes after last run
    return new Date(this.lastRunAt.getTime() + 30 * 60 * 1000);
  }
}

export const syncScheduler = new SyncScheduler();

