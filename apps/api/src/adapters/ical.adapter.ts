import ICAL from 'ical.js';
import { db } from '@unifiedstay/database';

// Use inline type to avoid Prisma generation dependency
interface ChannelMappingInput {
  id: string;
  channel: string;
  iCalUrl: string | null;
}

export interface CalendarSyncResult {
  success: boolean;
  eventsFound: number;
  eventsCreated: number;
  eventsUpdated: number;
  added: number;  // Alias for eventsCreated
  updated: number; // Alias for eventsUpdated
  error?: string;
}

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  description?: string;
}

class ICalAdapter {
  async syncCalendar(mapping: ChannelMappingInput, unitId: string): Promise<CalendarSyncResult> {
    if (!mapping.iCalUrl) {
      return {
        success: false,
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        added: 0,
        updated: 0,
        error: 'No iCal URL configured',
      };
    }

    try {
      // Fetch iCal data
      const response = await fetch(mapping.iCalUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch iCal: ${response.status}`);
      }

      const icalData = await response.text();
      const events = this.parseICalData(icalData);

      let eventsCreated = 0;
      let eventsUpdated = 0;

      // Process each event
      for (const event of events) {
        const externalId = `${mapping.channel}-${event.uid}`;

        // Check if reservation exists
        const existing = await db.reservation.findFirst({
          where: {
            channel: mapping.channel,
            externalId,
          },
        });

        if (existing) {
          // Update if dates changed
          if (
            existing.checkIn.getTime() !== event.dtstart.getTime() ||
            existing.checkOut.getTime() !== event.dtend.getTime()
          ) {
            await db.reservation.update({
              where: { id: existing.id },
              data: {
                checkIn: event.dtstart,
                checkOut: event.dtend,
                guestName: event.summary || 'Guest',
              },
            });
            eventsUpdated++;
          }
        } else {
          // Create new reservation
          await db.reservation.create({
            data: {
              unitId,
              channel: mapping.channel,
              externalId,
              guestName: event.summary || 'Guest',
              checkIn: event.dtstart,
              checkOut: event.dtend,
              status: 'confirmed',
            },
          });
          eventsCreated++;
        }
      }

      // Log sync
      await db.syncLog.create({
        data: {
          channelMappingId: mapping.id,
          status: 'success',
          eventsFound: events.length,
          eventsCreated,
          eventsUpdated,
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        eventsFound: events.length,
        eventsCreated,
        eventsUpdated,
        added: eventsCreated,
        updated: eventsUpdated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed sync
      await db.syncLog.create({
        data: {
          channelMappingId: mapping.id,
          status: 'failed',
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        eventsFound: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        added: 0,
        updated: 0,
        error: errorMessage,
      };
    }
  }

  private parseICalData(icalData: string): ICalEvent[] {
    try {
      const jcalData = ICAL.parse(icalData);
      const comp = new ICAL.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');

      const events: ICalEvent[] = [];

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);

        // Skip events without proper dates
        if (!event.startDate || !event.endDate) {
          continue;
        }

        events.push({
          uid: event.uid || crypto.randomUUID(),
          summary: event.summary || 'Blocked',
          dtstart: event.startDate.toJSDate(),
          dtend: event.endDate.toJSDate(),
          description: event.description || undefined,
        });
      }

      return events;
    } catch (error) {
      console.error('Failed to parse iCal data:', error);
      return [];
    }
  }
}

export const iCalAdapter = new ICalAdapter();

