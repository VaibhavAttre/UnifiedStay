import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Calendar, List, RefreshCw, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, getChannelColor, getChannelName } from '@/lib/utils';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval,
  parseISO,
  addYears,
  formatDistanceToNow,
} from 'date-fns';
import type { CalendarEvent } from '@unifiedstay/shared';

interface SyncStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResults: {
    channelId: string;
    propertyName: string;
    channel: string;
    success: boolean;
    eventsAdded: number;
    error?: string;
  }[];
}

export function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const queryClient = useQueryClient();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/properties'),
  });

  // Sync status
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.get<SyncStatus>('/calendar/sync/status'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const syncAllMutation = useMutation({
    mutationFn: () => api.post('/calendar/sync/all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-reservations'] });
    },
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'), selectedProperty],
    queryFn: () =>
      api.get<CalendarEvent[]>(
        `/calendar/events?start=${format(monthStart, 'yyyy-MM-dd')}&end=${format(monthEnd, 'yyyy-MM-dd')}${
          selectedProperty !== 'all' ? `&propertyId=${selectedProperty}` : ''
        }`
      ),
  });

  // Get all upcoming reservations for the next year
  const { data: upcomingReservations } = useQuery({
    queryKey: ['upcoming-reservations', selectedProperty],
    queryFn: () =>
      api.get<CalendarEvent[]>(
        `/calendar/events?start=${format(new Date(), 'yyyy-MM-dd')}&end=${format(addYears(new Date(), 1), 'yyyy-MM-dd')}${
          selectedProperty !== 'all' ? `&propertyId=${selectedProperty}` : ''
        }`
      ),
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = new Date();

  // Pad the calendar to start on Sunday
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(days);

  const getEventsForDay = (day: Date) => {
    return events?.filter((event) => {
      const checkIn = parseISO(event.checkIn as unknown as string);
      const checkOut = parseISO(event.checkOut as unknown as string);
      return isWithinInterval(day, { start: checkIn, end: checkOut }) || isSameDay(day, checkIn);
    });
  };

  const conflictingEvents = events?.filter((e) => e.hasConflict) ?? [];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Calendar</h1>
          <p className="text-muted-foreground">View reservations across all properties</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-background text-sm"
          >
            <option value="all">All Properties</option>
            {properties?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || syncStatus?.isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncAllMutation.isPending || syncStatus?.isRunning ? 'animate-spin' : ''} />
            Sync Now
          </button>
        </div>
      </div>

      {/* Auto-Sync Status Banner */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2 mb-6 text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              syncStatus?.isRunning ? "bg-amber-500 animate-pulse" : "bg-green-500"
            )} />
            <span className="text-muted-foreground">
              {syncStatus?.isRunning ? 'Syncing...' : 'Auto-sync active'}
            </span>
          </div>
          {syncStatus?.lastRunAt && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock size={14} />
              <span>Last synced {formatDistanceToNow(new Date(syncStatus.lastRunAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>
        <span className="text-muted-foreground">
          Syncs automatically every 30 minutes
        </span>
      </div>

      {/* Conflicts Alert */}
      {conflictingEvents.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-6">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">
              {conflictingEvents.length} booking conflict{conflictingEvents.length > 1 ? 's' : ''} detected
            </p>
            <p className="text-sm text-muted-foreground">
              Review overlapping reservations to avoid double bookings
            </p>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {paddedDays.map((day, index) => {
                if (!day) {
                  return <div key={`pad-${index}`} className="min-h-[100px] bg-muted/30" />;
                }

                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, today);
                const isCurrentMonth = isSameMonth(day, currentDate);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'min-h-[100px] border-b border-r border-border p-2',
                      !isCurrentMonth && 'bg-muted/30'
                    )}
                  >
                    <div
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1',
                        isToday && 'bg-primary text-primary-foreground font-bold',
                        !isCurrentMonth && 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-1">
                      {dayEvents?.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded truncate text-white',
                            event.hasConflict && 'ring-2 ring-destructive'
                          )}
                          style={{
                            backgroundColor: event.channel
                              ? getChannelColor(event.channel)
                              : '#6B7280',
                          }}
                          title={`${event.guestName || 'Block'} - ${getChannelName(event.channel || 'other')}`}
                        >
                          {event.guestName || event.type}
                        </div>
                      ))}
                      {(dayEvents?.length ?? 0) > 3 && (
                        <p className="text-xs text-muted-foreground px-1">
                          +{(dayEvents?.length ?? 0) - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4">
        {['airbnb', 'vrbo', 'booking', 'direct'].map((channel) => (
          <div key={channel} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getChannelColor(channel) }}
            />
            <span className="text-sm text-muted-foreground">{getChannelName(channel)}</span>
          </div>
        ))}
      </div>

      {/* Upcoming Reservations List */}
      {upcomingReservations && upcomingReservations.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <List size={20} className="text-primary" />
            <h2 className="text-lg font-display font-semibold">Upcoming Reservations</h2>
            <span className="text-sm text-muted-foreground">
              ({upcomingReservations.filter(r => r.type === 'booked').length} bookings)
            </span>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {upcomingReservations
                .filter(r => r.type === 'booked')
                .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
                .slice(0, 10)
                .map((reservation) => (
                  <div key={reservation.id} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getChannelColor(reservation.channel || 'other') }}
                      />
                      <div>
                        <p className="font-medium">{reservation.guestName || 'Guest'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(reservation.checkIn as unknown as string), 'MMM d, yyyy')} → {' '}
                          {format(parseISO(reservation.checkOut as unknown as string), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                        {getChannelName(reservation.channel || 'other')}
                      </span>
                      <button
                        onClick={() => setCurrentDate(parseISO(reservation.checkIn as unknown as string))}
                        className="ml-2 px-2 py-1 rounded text-xs font-medium hover:bg-accent transition-colors"
                        title="Jump to this date"
                      >
                        <Calendar size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            {upcomingReservations.filter(r => r.type === 'booked').length > 10 && (
              <div className="p-3 text-center text-sm text-muted-foreground border-t border-border">
                +{upcomingReservations.filter(r => r.type === 'booked').length - 10} more reservations
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

