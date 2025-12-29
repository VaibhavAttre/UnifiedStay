import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

  return formatDate(d);
}

export function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    airbnb: '#FF5A5F',
    vrbo: '#3D67FF',
    booking: '#003580',
    direct: '#10B981',
    other: '#6B7280',
  };
  return colors[channel] || colors.other;
}

export function getChannelName(channel: string): string {
  const names: Record<string, string> = {
    airbnb: 'Airbnb',
    vrbo: 'Vrbo',
    booking: 'Booking.com',
    direct: 'Direct',
    other: 'Other',
  };
  return names[channel] || channel;
}

export function generateId(): string {
  return crypto.randomUUID();
}

