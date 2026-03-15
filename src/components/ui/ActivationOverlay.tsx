type ActivationOverlayProps = {
  isVisible: boolean;
  title?: string;
  description?: string;
  stepLabel?: string;
};

export function ActivationOverlay({
  isVisible,
  title = 'Activando acceso',
  description = 'Estamos preparando tu cuenta dentro del sistema.',
  stepLabel = 'Procesando',
}: ActivationOverlayProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[color:var(--app-border)] opacity-60" />
            <div className="absolute inset-2 rounded-full border border-[color:var(--action-positive-border)] opacity-70" />
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--app-border)] border-t-[color:var(--action-positive-border)]" />
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {stepLabel}
          </p>

          <h2 className="text-xl font-semibold tracking-tight text-[var(--app-fg)]">
            {title}
          </h2>

          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
            {description}
          </p>

          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--action-positive-bg-hover)]" />
          </div>
        </div>
      </section>
    </div>
  );
}