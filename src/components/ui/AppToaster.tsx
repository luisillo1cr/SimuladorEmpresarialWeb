import { Toaster } from 'sileo';

export function AppToaster() {
  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex justify-center">
      <Toaster
        position="top-center"
        options={{
          fill: 'var(--toast-fill)',
          roundness: 20,
          autopilot: { expand: 260, collapse: 220 },
          styles: {
            title: 'text-[var(--toast-title)]! font-semibold!',
            description: 'text-[var(--toast-description)]!',
            badge: 'bg-[var(--toast-badge-bg)]!',
            button:
              'bg-[var(--toast-button-bg)]! hover:bg-[var(--toast-button-bg-hover)]! text-[var(--toast-button-fg)]!',
          },
        }}
      />
    </div>
  );
}