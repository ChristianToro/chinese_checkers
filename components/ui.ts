/**
 * Shared class strings for the café theme. Sizes (padding, text) are left to
 * the caller, so two conflicting size utilities never meet on one element.
 */

export const card =
  "rounded-2xl border border-line bg-surface/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_24px_48px_-28px_rgb(0_0_0/0.9)]";

export const buttonPrimary =
  "rounded-xl bg-brass font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_-10px_rgb(212_162_84/0.6)] transition hover:bg-brass-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-60";

export const buttonSecondary =
  "rounded-xl border border-line bg-raised font-medium text-cream transition hover:border-brass/40 hover:bg-raised/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-50";

export const input =
  "w-full rounded-lg border border-line bg-ink/60 px-3 py-2 text-base text-cream outline-none transition focus:border-brass focus:ring-2 focus:ring-brass/30 aria-[invalid=true]:border-red-400";

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.18em] text-brass";

export const alertError =
  "rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200";

export const fieldError = "text-sm text-red-300";
