import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

type AppShellProps = {
  title: string;
  subtitle?: string;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  children: ReactNode;
};

export function AppShell({
  title,
  subtitle,
  isDarkMode,
  onToggleTheme,
  onLogout,
  onOpenProfile,
  children,
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      {isSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] xl:hidden"
          aria-label="Cerrar menú lateral"
        />
      ) : null}

      <div className="flex min-h-screen">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={onLogout}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar
            title={title}
            subtitle={subtitle}
            isDarkMode={isDarkMode}
            onToggleTheme={onToggleTheme}
            onOpenProfile={onOpenProfile}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />

          <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
