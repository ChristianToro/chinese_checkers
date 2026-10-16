import Avatar from "../Avatar";
import { MarbleDot } from "../board-art";

/** An illustration of inviting someone: a game link and the "joined" moment. */
export default function InviteCard() {
  return (
    <figure aria-label="Example invite" className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/60 py-1.5 pl-3 pr-1.5">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" aria-hidden>
          <path
            d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          <span className="text-muted">…/games/</span>k3f9q2
        </span>
        <span className="shrink-0 rounded-lg bg-brass px-2.5 py-1 text-xs font-semibold text-ink">
          Copied!
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2">
        <Avatar avatar="rabbit" size={28} />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">sol</span> joined as Blue
        </span>
        <MarbleDot color="sapphire" />
      </div>
      <figcaption className="text-xs leading-relaxed text-muted">
        New Game opens a table with a link like this one. Whoever opens it signed in takes the Blue seat.
      </figcaption>
    </figure>
  );
}
