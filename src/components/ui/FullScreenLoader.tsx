type FullScreenLoaderProps = {
  title?: string;
  description?: string;
};

export function FullScreenLoader({
  title = 'Cargando sesión',
  description = 'Estamos validando tu acceso al sistema.',
}: FullScreenLoaderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-[var(--app-fg)]">
      <section className="w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-[color:var(--app-border)] opacity-70" />
            <div className="absolute inset-2 rounded-full border border-[color:var(--action-positive-border)] opacity-60" />
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--app-border)] border-t-[color:var(--action-positive-bg-hover)]" />
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Inicializando
          </p>

          <h1 className="text-lg font-semibold tracking-tight text-[var(--app-fg)]">
            {title}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {description}
          </p>

          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--action-positive-bg-hover)]" />
          </div>
        </div>
      </section>
    </main>
  );
}