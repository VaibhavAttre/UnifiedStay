import { db } from '@unifiedstay/database';
import type {
  CreateReservationInput,
  CreateBlockInput,
  CalendarEvent,
  ConflictInfo,
  DateRange,
} from '@unifiedstay/shared';
import { iCalAdapter } from '../../adapters/ical.adapter.js';

class CalendarService {
  async getEvents(
    userId: string,
    options: { start: Date; end: Date; propertyId?: string }
  ): Promise<CalendarEvent[]> {
    // Get user's properties
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(options.propertyId ? { id: options.propertyId } : {}),
      },
      include: {
        units: true,
      },
    });

    const unitIds = properties.flatMap((p) => p.units.map((u) => u.id));

    if (unitIds.length === 0) {
      return [];
    }

    // Get reservations
    const reservations = await db.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        status: { in: ['confirmed', 'pending'] },
        OR: [
          {
            checkIn: { gte: options.start, lte: options.end },
          },
          {
            checkOut: { gte: options.start, lte: options.end },
          },
          {
            AND: [{ checkIn: { lte: options.start } }, { checkOut: { gte: options.end } }],
          },
        ],
      },
      include: {
        unit: {
          include: {
            property: true,
          },
        },
      },
    });

    // Get blocks
    const blocks = await db.availabilityBlock.findMany({
      where: {
        unitId: { in: unitIds },
        OR: [
          {
            startDate: { gte: options.start, lte: options.end },
          },
          {
            endDate: { gte: options.start, lte: options.end },
          },
          {
            AND: [{ startDate: { lte: options.start } }, { endDate: { gte: options.end } }],
          },
        ],
      },
      include: {
        unit: {
          include: {
            property: true,
          },
        },
      },
    });

    // Convert to calendar events
    const events: CalendarEvent[] = [
      ...reservations.map((r) => ({
        id: r.id,
        unitId: r.unitId,
        propertyId: r.unit.propertyId,
        type: 'booked' as const,
        channel: r.channel,
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        externalId: r.externalId || undefined,
        hasConflict: false,
      })),
      ...blocks.map((b) => ({
        id: b.id,
        unitId: b.unitId,
        propertyId: b.unit.propertyId,
        type: b.type,
        checkIn: b.startDate,
        checkOut: b.endDate,
        hasConflict: false,
      })),
    ];

    // Detect conflicts
    const conflicts = this.detectConflicts(events);
    const conflictEventIds = new Set(
      conflicts.flatMap((c) => [c.eventA.id, c.eventB.id])
    );

    // Mark conflicting events
    for (const event of events) {
      event.hasConflict = conflictEventIds.has(event.id);
    }

    return events;
  }

  async getReservations(userId: string, filters: { propertyId?: string; status?: string }) {
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(filters.propertyId ? { id: filters.propertyId } : {}),
      },
      include: { units: true },
    });

    const unitIds = properties.flatMap((p) => p.units.map((u) => u.id));

    return db.reservation.findMany({
      where: {
        unitId: { in: unitIds },
        ...(filters.status ? { status: filters.status as any } : {}),
      },
      include: {
        unit: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { checkIn: 'asc' },
    });
  }

  async createReservation(userId: string, input: CreateReservationInput) {
    // Verify the unit belongs to user
    const unit = await db.unit.findFirst({
      where: {
        id: input.unitId,
        property: { userId },
      },
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    // Check for conflicts
    const existingReservations = await db.reservation.findMany({
      where: {
        unitId: input.unitId,
        status: { in: ['confirmed', 'pending'] },
        OR: [
          {
            AND: [
              { checkIn: { lt: input.checkOut } },
              { checkOut: { gt: input.checkIn } },
            ],
          },
        ],
      },
    });

    if (existingReservations.length > 0) {
      throw new Error('Dates conflict with existing reservation');
    }

    return db.reservation.create({
      data: {
        unitId: input.unitId,
        channel: input.channel,
        guestName: input.guestName,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        totalAmount: input.totalAmount,
        externalId: input.externalId,
      },
    });
  }

  async createBlock(userId: string, input: CreateBlockInput) {
    // Verify the unit belongs to user
    const unit = await db.unit.findFirst({
      where: {
        id: input.unitId,
        property: { userId },
      },
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    return db.availabilityBlock.create({
      data: {
        unitId: input.unitId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        notes: input.notes,
      },
    });
  }

  async deleteBlock(userId: string, blockId: string) {
    const block = await db.availabilityBlock.findFirst({
      where: {
        id: blockId,
        unit: {
          property: { userId },
        },
      },
    });

    if (!block) {
      throw new Error('Block not found');
    }

    await db.availabilityBlock.delete({
      where: { id: blockId },
    });
  }

  async syncChannel(userId: string, channelMappingId: string) {
    // Get the channel mapping
    const mapping = await db.channelMapping.findFirst({
      where: {
        id: channelMappingId,
        property: { userId },
      },
      include: {
        property: {
          include: { units: true },
        },
      },
    });

    if (!mapping) {
      throw new Error('Channel mapping not found');
    }

    if (!mapping.iCalUrl) {
      throw new Error('No iCal URL configured for this channel');
    }

    // Get the first unit (for now, assume single unit per property)
    const unit = mapping.property.units[0];
    if (!unit) {
      throw new Error('Property has no units');
    }

    // Sync using iCal adapter
    const result = await iCalAdapter.syncCalendar(mapping, unit.id);

    // Update last sync time
    await db.channelMapping.update({
      where: { id: channelMappingId },
      data: {
        lastSyncAt: new Date(),
        lastSyncError: result.error || null,
      },
    });

    return result;
  }

  async getConflicts(userId: string, propertyId?: string): Promise<ConflictInfo[]> {
    const now = new Date();
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const events = await this.getEvents(userId, {
      start: now,
      end: futureDate,
      propertyId,
    });

    return this.detectConflicts(events);
  }

  private detectConflicts(events: CalendarEvent[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Group events by unit
    const eventsByUnit = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!eventsByUnit.has(event.unitId)) {
        eventsByUnit.set(event.unitId, []);
      }
      eventsByUnit.get(event.unitId)!.push(event);
    }

    // Check for overlaps within each unit
    for (const [unitId, unitEvents] of eventsByUnit) {
      // Sort by check-in date
      unitEvents.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

      for (let i = 0; i < unitEvents.length; i++) {
        for (let j = i + 1; j < unitEvents.length; j++) {
          const eventA = unitEvents[i];
          const eventB = unitEvents[j];

          const aStart = new Date(eventA.checkIn).getTime();
          const aEnd = new Date(eventA.checkOut).getTime();
          const bStart = new Date(eventB.checkIn).getTime();
          const bEnd = new Date(eventB.checkOut).getTime();

          // Check if they overlap
          if (aStart < bEnd && bStart < aEnd) {
            conflicts.push({
              eventA,
              eventB,
              overlapStart: new Date(Math.max(aStart, bStart)),
              overlapEnd: new Date(Math.min(aEnd, bEnd)),
            });
          }
        }
      }
    }

    return conflicts;
  }
}

export const calendarService = new CalendarService();

