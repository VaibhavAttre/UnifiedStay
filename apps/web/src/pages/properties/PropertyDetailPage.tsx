import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, MapPin, Clock, Settings, Plus, Loader2, LinkIcon, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { getChannelColor, getChannelName } from '@/lib/utils';
import { useState } from 'react';
import { AddChannelModal } from '@/components/properties/AddChannelModal';

interface ChannelMapping {
  id: string;
  channel: string;
  externalId?: string;
  iCalUrl?: string;
  lastSyncAt?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  timezone: string;
  defaultMinNights: number;
  cleaningBufferHours: number;
  channelMappings: ChannelMapping[];
  units: { id: string; name: string }[];
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get<Property>(`/properties/${id}`),
    enabled: !!id,
  });

  const syncMutation = useMutation({
    mutationFn: (channelMappingId: string) => 
      api.post<{ success: boolean; eventsFound: number; eventsCreated: number }>(`/calendar/sync/${channelMappingId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      alert(`Sync complete! Found ${data.eventsFound} events, created ${data.eventsCreated} new reservations.`);
    },
    onError: (err) => {
      alert(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
    onSettled: () => {
      setSyncingChannelId(null);
    },
  });

  const handleSync = (channelId: string) => {
    setSyncingChannelId(channelId);
    syncMutation.mutate(channelId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-6 lg:p-8">
        <p>Property not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/properties"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft size={16} />
          Back to Properties
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">{property.name}</h1>
              <div className="flex items-center gap-1 text-muted-foreground mt-1">
                <MapPin size={16} />
                <span>{property.address}</span>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors">
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Timezone</p>
          <p className="font-medium">{property.timezone}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Min Nights</p>
          <p className="font-medium">{property.defaultMinNights}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Cleaning Buffer</p>
          <p className="font-medium">{property.cleaningBufferHours}h</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Units</p>
          <p className="font-medium">{property.units?.length ?? 0}</p>
        </div>
      </div>

      {/* Channel Connections */}
      <div className="bg-card rounded-xl border border-border p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Channel Connections</h2>
          <button
            onClick={() => setShowChannelModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Add Channel
          </button>
        </div>

        {property.channelMappings?.length === 0 ? (
          <div className="text-center py-8">
            <LinkIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No channels connected yet</p>
            <button
              onClick={() => setShowChannelModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Connect Channel
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {property.channelMappings.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getChannelColor(channel.channel) }}
                  />
                  <div>
                    <p className="font-medium">{getChannelName(channel.channel)}</p>
                    <p className="text-sm text-muted-foreground">
                      {channel.iCalUrl ? 'iCal connected' : 'Manual entry'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {channel.lastSyncAt && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>Synced: {new Date(channel.lastSyncAt).toLocaleString()}</span>
                    </div>
                  )}
                  {channel.iCalUrl && (
                    <button
                      onClick={() => handleSync(channel.id)}
                      disabled={syncingChannelId === channel.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={syncingChannelId === channel.id ? 'animate-spin' : ''} />
                      {syncingChannelId === channel.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Channel Modal */}
      <AddChannelModal
        propertyId={property.id}
        open={showChannelModal}
        onClose={() => setShowChannelModal(false)}
      />
    </div>
  );
}

