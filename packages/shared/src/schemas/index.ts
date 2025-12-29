import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

// Property schemas
export const createPropertySchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  address: z.string().min(1, 'Address is required'),
  timezone: z.string().default('America/New_York'),
  defaultMinNights: z.number().int().min(1).default(1),
  cleaningBufferHours: z.number().int().min(0).default(4),
});

export const updatePropertySchema = createPropertySchema.partial();

// Channel mapping schemas
export const channelTypes = ['airbnb', 'vrbo', 'booking', 'direct', 'other'] as const;

export const createChannelMappingSchema = z.object({
  channel: z.enum(channelTypes),
  externalId: z.string().optional(),
  iCalUrl: z.string().url().optional(),
});

// Reservation schemas
export const reservationStatusTypes = ['confirmed', 'pending', 'cancelled', 'completed'] as const;

export const createReservationSchema = z.object({
  unitId: z.string().uuid(),
  channel: z.enum(channelTypes),
  guestName: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  totalAmount: z.number().min(0).optional(),
  externalId: z.string().optional(),
});

// Block schemas
export const blockTypes = ['blocked', 'maintenance', 'hold'] as const;

export const createBlockSchema = z.object({
  unitId: z.string().uuid(),
  type: z.enum(blockTypes),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  notes: z.string().optional(),
});

// Task schemas
export const taskTypes = ['cleaning', 'maintenance', 'inspection', 'restock', 'other'] as const;
export const taskStatusTypes = ['pending', 'in_progress', 'completed', 'cancelled'] as const;

export const createTaskSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(taskTypes),
  description: z.string().optional(),
  dueAt: z.coerce.date(),
  assigneeId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  status: z.enum(taskStatusTypes).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  completionNotes: z.string().optional(),
});

// Finance schemas
export const expenseCategories = [
  'cleaning',
  'maintenance',
  'supplies',
  'utilities',
  'mortgage',
  'insurance',
  'taxes',
  'marketing',
  'software',
  'other',
] as const;

export const createExpenseSchema = z.object({
  propertyId: z.string().uuid(),
  category: z.enum(expenseCategories),
  amount: z.number().positive('Amount must be positive'),
  date: z.coerce.date(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional(),
});

export const createRevenueSchema = z.object({
  propertyId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  amount: z.number().positive('Amount must be positive'),
  date: z.coerce.date(),
  channel: z.enum(channelTypes).optional(),
  description: z.string().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Date range schema
export const dateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateChannelMappingInput = z.infer<typeof createChannelMappingSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateRevenueInput = z.infer<typeof createRevenueSchema>;

