"use client";

/**
 * TaskCompletionIndicator — Indicador visual de tareas completadas.
 * Muestra ratio (X/Y) + iconos circulares por tarea (check o X) con tooltip.
 */

interface Task {
  taskId: string;
  taskName: string;
  completed: boolean;
}

interface TaskCompletionIndicatorProps {
  tasks: Task[];
}

export function TaskCompletionIndicator({ tasks }: TaskCompletionIndicatorProps) {
  const completed = tasks.filter(t => t.completed).length;
  const total = tasks.length;

  if (total === 0) return <span className="text-sm text-text-muted">—</span>;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">{completed}/{total}</span>
      <div className="flex gap-1">
        {tasks.map((task) => (
          <span
            key={task.taskId}
            title={task.taskName}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
              task.completed
                ? "bg-success/15 text-success"
                : "bg-border-default/50 text-text-muted"
            }`}
          >
            {task.completed ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
