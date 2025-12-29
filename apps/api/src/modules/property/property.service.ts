import { db } from '@unifiedstay/database';
import type { CreatePropertyInput, UpdatePropertyInput, CreateChannelMappingInput } from '@unifiedstay/shared';

class PropertyService {
  async getAll(userId: string) {
    return db.property.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            units: true,
            channelMappings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, userId: string) {
    const property = await db.property.findFirst({
      where: { id, userId },
      include: {
        units: true,
        channelMappings: true,
      },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    return property;
  }

  async create(userId: string, input: CreatePropertyInput) {
    // Create property with a default unit
    const property = await db.property.create({
      data: {
        userId,
        name: input.name,
        address: input.address,
        timezone: input.timezone,
        defaultMinNights: input.defaultMinNights,
        cleaningBufferHours: input.cleaningBufferHours,
        units: {
          create: {
            name: 'Main Unit',
          },
        },
      },
      include: {
        units: true,
        channelMappings: true,
        _count: {
          select: {
            units: true,
            channelMappings: true,
          },
        },
      },
    });

    return property;
  }

  async update(id: string, userId: string, input: UpdatePropertyInput) {
    // Verify ownership
    const existing = await db.property.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Property not found');
    }

    return db.property.update({
      where: { id },
      data: {
        name: input.name,
        address: input.address,
        timezone: input.timezone,
        defaultMinNights: input.defaultMinNights,
        cleaningBufferHours: input.cleaningBufferHours,
      },
      include: {
        units: true,
        channelMappings: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    // Verify ownership
    const existing = await db.property.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Property not found');
    }

    await db.property.delete({
      where: { id },
    });
  }

  async addChannelMapping(propertyId: string, userId: string, input: CreateChannelMappingInput) {
    // Verify ownership
    const property = await db.property.findFirst({
      where: { id: propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    // Check if channel already exists for this property
    const existing = await db.channelMapping.findUnique({
      where: {
        propertyId_channel: {
          propertyId,
          channel: input.channel,
        },
      },
    });

    if (existing) {
      throw new Error(`${input.channel} channel is already connected to this property`);
    }

    // Determine capabilities based on what's provided
    const capabilities = {
      calendarRead: !!input.iCalUrl,
      calendarWrite: false,
      messagingRead: false,
      messagingSend: false,
      pricingWrite: false,
      payoutsRead: false,
    };

    return db.channelMapping.create({
      data: {
        propertyId,
        channel: input.channel,
        externalId: input.externalId,
        iCalUrl: input.iCalUrl,
        capabilities,
      },
    });
  }

  async removeChannelMapping(propertyId: string, userId: string, channelId: string) {
    // Verify ownership
    const property = await db.property.findFirst({
      where: { id: propertyId, userId },
    });

    if (!property) {
      throw new Error('Property not found');
    }

    const mapping = await db.channelMapping.findFirst({
      where: { id: channelId, propertyId },
    });

    if (!mapping) {
      throw new Error('Channel mapping not found');
    }

    await db.channelMapping.delete({
      where: { id: channelId },
    });
  }
}

export const propertyService = new PropertyService();

