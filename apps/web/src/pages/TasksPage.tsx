import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Plus, Loader2, Filter, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelativeDate } from '@/lib/utils';
import { AddTaskModal } from '@/components/tasks/AddTaskModal';
import type { TaskStatus, TaskType } from '@unifiedstay/shared';

interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  description?: string;
  dueAt: string;
  property: { id: string; name: string };
  reservation?: { guestName: string };
  assignee?: { name: string };
}

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-200',
  in_progress: 'bg-blue-500/10 text-blue-600 border-blue-200',
  completed: 'bg-green-500/10 text-green-600 border-green-200',
  cancelled: 'bg-gray-500/10 text-gray-600 border-gray-200',
};

const typeLabels: Record<TaskType, string> = {
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  inspection: 'Inspection',
  restock: 'Restock',
  other: 'Other',
};

export function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () =>
      api.get<Task[]>(`/tasks${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.patch(`/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTaskMutation.mutate({ id: taskId, status: newStatus });
  };

  const pendingCount = tasks?.filter((t) => t.status === 'pending').length ?? 0;
  const inProgressCount = tasks?.filter((t) => t.status === 'in_progress').length ?? 0;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending, {inProgressCount} in progress
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      <AddTaskModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter size={16} className="text-muted-foreground" />
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              statusFilter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            )}
          >
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tasks?.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
          <p className="text-muted-foreground">
            {statusFilter !== 'all' ? 'Try changing the filter' : 'Tasks will appear here as reservations are made'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks?.map((task, index) => (
            <div
              key={task.id}
            className="bg-card rounded-xl border border-border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      handleStatusChange(
                        task.id,
                        task.status === 'completed' ? 'pending' : 'completed'
                      )
                    }
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      task.status === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-muted-foreground/30 hover:border-primary'
                    )}
                  >
                    {task.status === 'completed' && <Check size={14} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium border',
                          statusColors[task.status]
                        )}
                      >
                        {typeLabels[task.type]}
                      </span>
                      <span className="text-sm font-medium">{task.property.name}</span>
                    </div>

                    <p
                      className={cn(
                        'mt-1',
                        task.status === 'completed' && 'line-through text-muted-foreground'
                      )}
                    >
                      {task.description || `${typeLabels[task.type]} task`}
                      {task.reservation && ` for ${task.reservation.guestName}`}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{formatRelativeDate(task.dueAt)}</span>
                      </div>
                      {task.assignee && <span>Assigned to {task.assignee.name}</span>}
                    </div>
                  </div>
                </div>

                {task.status !== 'completed' && (
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    className="px-2 py-1 rounded border border-input bg-background text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

