import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from '../ui/ThemeToggle';

type TopbarProps = {
  title: string;
  subtitle?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile?: () => void;
  onOpenSidebar?: () => void;
};

export function Topbar({
  title,
  subtitle,
  isDarkMode,
  onToggleTheme,
  onOpenProfile,
  onOpenSidebar,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--app-border)] bg-white/72 backdrop-blur-xl dark:bg-[#2a2a2a]/72">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl transition hover:bg-white dark:bg-[#2a2a2a]/75 dark:text-slate-200 dark:hover:bg-[#323232] xl:hidden"
            aria-label="Abrir menú"
            title="Abrir menú"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--app-fg)] sm:text-2xl">
              {title}
            </h1>

            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <NotificationBell />

          {onOpenProfile ? (
            <button
              type="button"
              onClick={onOpenProfile}
              aria-label="Abrir perfil"
              title="Abrir perfil"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl transition hover:bg-white dark:bg-[#2a2a2a]/75 dark:text-slate-200 dark:hover:bg-[#323232]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            </button>
          ) : null}

          <ThemeToggle isDarkMode={isDarkMode} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
