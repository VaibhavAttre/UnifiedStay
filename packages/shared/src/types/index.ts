// Channel types
export type ChannelType = 'airbnb' | 'vrbo' | 'booking' | 'direct' | 'other';

// Capability flags for channel adapters
export interface CapabilityFlags {
  calendarRead: boolean;
  calendarWrite: boolean;
  messagingRead: boolean;
  messagingSend: boolean;
  pricingWrite: boolean;
  payoutsRead: boolean;
}

// Reservation status
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

// Availability block types
export type BlockType = 'booked' | 'blocked' | 'maintenance' | 'hold';

// Task types and status
export type TaskType = 'cleaning' | 'maintenance' | 'inspection' | 'restock' | 'other';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

// Expense categories
export type ExpenseCategory =
  | 'cleaning'
  | 'maintenance'
  | 'supplies'
  | 'utilities'
  | 'mortgage'
  | 'insurance'
  | 'taxes'
  | 'marketing'
  | 'software'
  | 'other';

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Date range
export interface DateRange {
  start: Date;
  end: Date;
}

// Calendar event for unified calendar view
export interface CalendarEvent {
  id: string;
  unitId: string;
  propertyId: string;
  type: BlockType;
  channel?: ChannelType;
  guestName?: string;
  checkIn: Date;
  checkOut: Date;
  externalId?: string;
  hasConflict?: boolean;
}

// Conflict info
export interface ConflictInfo {
  eventA: CalendarEvent;
  eventB: CalendarEvent;
  overlapStart: Date;
  overlapEnd: Date;
}

// Dashboard summary
export interface DashboardSummary {
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
  pendingTasks: number;
  activeConflicts: number;
  occupancyRate: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
}

