import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Calendar, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import type { TaskType } from '@unifiedstay/shared';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
}

const taskTypes: { value: TaskType; label: string; description: string }[] = [
  { value: 'cleaning', label: 'Cleaning', description: 'Post-checkout cleaning' },
  { value: 'maintenance', label: 'Maintenance', description: 'Repairs and fixes' },
  { value: 'inspection', label: 'Inspection', description: 'Property inspection' },
  { value: 'restock', label: 'Restock', description: 'Restock supplies' },
  { value: 'other', label: 'Other', description: 'Custom task' },
];

export function AddTaskModal({ open, onClose }: AddTaskModalProps) {
  const [propertyId, setPropertyId] = useState('');
  const [type, setType] = useState<TaskType>('cleaning');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const { data: properties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.get<{ id: string; name: string }[]>('/properties'),
  });

  const mutation = useMutation({
    mutationFn: (data: { propertyId: string; type: TaskType; description?: string; dueAt: Date }) =>
      api.post('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      handleClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    },
  });

  const handleClose = () => {
    setPropertyId('');
    setType('cleaning');
    setDescription('');
    setDueAt('');
    setError('');
    mutation.reset();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!propertyId) {
      setError('Please select a property');
      return;
    }

    if (!dueAt) {
      setError('Please set a due date');
      return;
    }

    mutation.mutate({
      propertyId,
      type,
      description: description || undefined,
      dueAt: new Date(dueAt),
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

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold">Add Task</h2>
            <p className="text-sm text-muted-foreground">Create a new task for your property</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Property Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              required
            >
              <option value="">Select a property</option>
              {properties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Task Type</label>
            <div className="grid grid-cols-2 gap-2">
              {taskTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    type === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any details about this task..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Due Date & Time</label>
            <div className="relative">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            </div>
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
                'Create Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

