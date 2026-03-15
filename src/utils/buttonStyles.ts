export const baseActionButtonClass =
  'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60';

export const positiveActionButtonClass =
  `${baseActionButtonClass} border border-[color:var(--action-positive-border)] bg-[var(--action-positive-bg)] text-[var(--action-positive-fg)] hover:bg-[var(--action-positive-bg-hover)]`;

export const negativeActionButtonClass =
  `${baseActionButtonClass} border border-[color:var(--action-negative-border)] bg-[var(--action-negative-bg)] text-[var(--action-negative-fg)] hover:bg-[var(--action-negative-bg-hover)]`;

export const neutralActionButtonClass =
  `${baseActionButtonClass} border border-[color:var(--action-neutral-border)] bg-[var(--action-neutral-bg)] text-[var(--action-neutral-fg)] hover:bg-[var(--action-neutral-bg-hover)]`;