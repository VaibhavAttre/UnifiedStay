import { db } from '@unifiedstay/database';
import { addHours } from 'date-fns';
import type { CreateTaskInput, UpdateTaskInput } from '@unifiedstay/shared';

class TaskService {
  async getAll(
    userId: string,
    filters: { status?: string; propertyId?: string; type?: string }
  ) {
    const properties = await db.property.findMany({
      where: {
        userId,
        ...(filters.propertyId ? { id: filters.propertyId } : {}),
      },
      select: { id: true },
    });

    const propertyIds = properties.map((p) => p.id);

    return db.task.findMany({
      where: {
        propertyId: { in: propertyIds },
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.type ? { type: filters.type as any } : {}),
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
        reservation: {
          select: { id: true, guestName: true, checkIn: true, checkOut: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
  }

  async getById(userId: string, taskId: string) {
    const task = await db.task.findFirst({
      where: {
        id: taskId,
        property: { userId },
      },
      include: {
        property: true,
        reservation: true,
        assignee: true,
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  async create(userId: string, input: CreateTaskInput) {
    // Verify property ownership
    const property = await db.property.findFirst({
      where: { id: input.propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    return db.task.create({
      data: {
        propertyId: input.propertyId,
        type: input.type,
        description: input.description,
        dueAt: input.dueAt,
        assigneeId: input.assigneeId,
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async update(userId: string, taskId: string, input: UpdateTaskInput) {
    // Verify ownership
    const existing = await db.task.findFirst({
      where: {
        id: taskId,
        property: { userId },
      },
    });

    if (!existing) {
      throw new Error('Task not found');
    }

    const updateData: any = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }

    if (input.assigneeId !== undefined) {
      updateData.assigneeId = input.assigneeId;
    }

    if (input.completionNotes !== undefined) {
      updateData.completionNotes = input.completionNotes;
    }

    return db.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        property: {
          select: { id: true, name: true },
        },
        reservation: {
          select: { id: true, guestName: true },
        },
        assignee: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async delete(userId: string, taskId: string) {
    const task = await db.task.findFirst({
      where: {
        id: taskId,
        property: { userId },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    await db.task.delete({
      where: { id: taskId },
    });
  }

  async generateTurnoverTasks(userId: string) {
    // Get all properties with their settings
    const properties = await db.property.findMany({
      where: { userId },
      include: {
        units: true,
      },
    });

    let tasksCreated = 0;

    for (const property of properties) {
      const unitIds = property.units.map((u) => u.id);

      // Get upcoming checkouts without existing cleaning tasks
      const upcomingReservations = await db.reservation.findMany({
        where: {
          unitId: { in: unitIds },
          status: { in: ['confirmed', 'pending'] },
          checkOut: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          },
        },
        include: {
          tasks: {
            where: { type: 'cleaning' },
          },
        },
      });

      for (const reservation of upcomingReservations) {
        // Skip if cleaning task already exists
        if (reservation.tasks.length > 0) {
          continue;
        }

        // Create cleaning task
        const dueAt = addHours(
          new Date(reservation.checkOut),
          property.cleaningBufferHours
        );

        await db.task.create({
          data: {
            propertyId: property.id,
            reservationId: reservation.id,
            type: 'cleaning',
            description: `Cleaning after ${reservation.guestName}'s checkout`,
            dueAt,
            status: 'pending',
          },
        });

        tasksCreated++;
      }
    }

    return { tasksCreated };
  }
}

export const taskService = new TaskService();

