import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getChannelColor, getChannelName } from '@/lib/utils';
import type { ChannelType } from '@unifiedstay/shared';

interface AddChannelModalProps {
  propertyId: string;
  open: boolean;
  onClose: () => void;
}

const channels: ChannelType[] = ['airbnb', 'vrbo', 'booking', 'direct', 'other'];

export function AddChannelModal({ propertyId, open, onClose }: AddChannelModalProps) {
  const [channel, setChannel] = useState<ChannelType>('airbnb');
  const [iCalUrl, setICalUrl] = useState('');
  const [externalId, setExternalId] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { channel: ChannelType; iCalUrl?: string; externalId?: string }) =>
      api.post(`/properties/${propertyId}/channels`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      handleClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add channel');
    },
  });

  const handleClose = () => {
    setChannel('airbnb');
    setICalUrl('');
    setExternalId('');
    setError('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({
      channel,
      iCalUrl: iCalUrl || undefined,
      externalId: externalId || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-xl border border-border w-full max-w-md p-6 animate-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-display font-bold mb-6">Connect Channel</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Channel</label>
            <div className="grid grid-cols-2 gap-2">
              {channels.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    channel === ch
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getChannelColor(ch) }}
                  />
                  <span className="text-sm font-medium">{getChannelName(ch)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              iCal URL <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="url"
              value={iCalUrl}
              onChange={(e) => setICalUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://www.airbnb.com/calendar/ical/..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste the iCal export URL from your channel to sync reservations automatically
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              External Listing ID <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="12345678"
            />
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
                  Connecting...
                </>
              ) : (
                'Connect Channel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

