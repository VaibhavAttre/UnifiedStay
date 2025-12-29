import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getChannelColor, getChannelName } from '@/lib/utils';
import type { ChannelType } from '@unifiedstay/shared';

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
}

interface ChannelInput {
  id: string;
  channel: ChannelType;
  iCalUrl: string;
}

const channels: ChannelType[] = ['airbnb', 'vrbo', 'booking', 'direct', 'other'];

export function AddPropertyModal({ open, onClose }: AddPropertyModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [defaultMinNights, setDefaultMinNights] = useState(1);
  const [cleaningBufferHours, setCleaningBufferHours] = useState(4);
  const [channelInputs, setChannelInputs] = useState<ChannelInput[]>([]);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: {
      name: string;
      address: string;
      timezone: string;
      defaultMinNights: number;
      cleaningBufferHours: number;
      channels: { channel: ChannelType; iCalUrl?: string }[];
    }) => {
      // Create property first
      const property = await api.post<{ id: string }>('/properties', {
        name: data.name,
        address: data.address,
        timezone: data.timezone,
        defaultMinNights: data.defaultMinNights,
        cleaningBufferHours: data.cleaningBufferHours,
      });

      // Add channels if any
      for (const ch of data.channels) {
        if (ch.iCalUrl) {
          await api.post(`/properties/${property.id}/channels`, {
            channel: ch.channel,
            iCalUrl: ch.iCalUrl,
          });
        }
      }

      return property;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      handleClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create property');
    },
  });

  const handleClose = () => {
    setName('');
    setAddress('');
    setTimezone('America/New_York');
    setDefaultMinNights(1);
    setCleaningBufferHours(4);
    setChannelInputs([]);
    setError('');
    onClose();
  };

  const addChannel = () => {
    setChannelInputs([
      ...channelInputs,
      { id: crypto.randomUUID(), channel: 'airbnb', iCalUrl: '' },
    ]);
  };

  const removeChannel = (id: string) => {
    setChannelInputs(channelInputs.filter((c) => c.id !== id));
  };

  const updateChannel = (id: string, field: 'channel' | 'iCalUrl', value: string) => {
    setChannelInputs(
      channelInputs.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      name,
      address,
      timezone,
      defaultMinNights,
      cleaningBufferHours,
      channels: channelInputs.filter((c) => c.iCalUrl),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-display font-bold mb-6">Add Property</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Property Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Beach House #1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="123 Ocean Drive, Miami, FL"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Phoenix">Arizona Time</option>
              <option value="Pacific/Honolulu">Hawaii Time</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Min Nights</label>
              <input
                type="number"
                value={defaultMinNights}
                onChange={(e) => setDefaultMinNights(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cleaning Buffer (hrs)</label>
              <input
                type="number"
                value={cleaningBufferHours}
                onChange={(e) => setCleaningBufferHours(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                min={0}
              />
            </div>
          </div>

          {/* Calendar Sync Section */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-medium">Calendar Sync</label>
                <p className="text-xs text-muted-foreground">
                  Add iCal URLs from Airbnb, Vrbo, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={addChannel}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus size={16} />
                Add Channel
              </button>
            </div>

            {channelInputs.length === 0 ? (
              <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground mb-2">No channels added yet</p>
                <p className="text-xs text-muted-foreground">
                  Click "Add Channel" to sync calendars from Airbnb, Vrbo, etc.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {channelInputs.map((input) => (
                  <div
                    key={input.id}
                    className="p-3 rounded-lg bg-muted/30 border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <select
                        value={input.channel}
                        onChange={(e) =>
                          updateChannel(input.id, 'channel', e.target.value)
                        }
                        className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm"
                      >
                        {channels.map((ch) => (
                          <option key={ch} value={ch}>
                            {getChannelName(ch)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeChannel(input.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      type="url"
                      value={input.iCalUrl}
                      onChange={(e) =>
                        updateChannel(input.id, 'iCalUrl', e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Paste iCal URL here..."
                    />
                    <p className="text-xs text-muted-foreground">
                      {input.channel === 'airbnb' && (
                        <>Airbnb → Calendar → Export Calendar → Copy Link</>
                      )}
                      {input.channel === 'vrbo' && (
                        <>Vrbo → Calendar → Export → Copy iCal URL</>
                      )}
                      {input.channel === 'booking' && (
                        <>Booking.com → Calendar → Sync calendars → Export</>
                      )}
                      {(input.channel === 'direct' || input.channel === 'other') && (
                        <>Paste any valid iCal (.ics) URL</>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Property'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
