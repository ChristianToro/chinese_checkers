import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import UserMenu from "./UserMenu";

/** A six-pointed star in brass, the site's mark. */
function StarMark() {
  return (
    <svg viewBox="-12 -12 24 24" className="size-7" aria-hidden>
      <polygon points="0,-11 9.5,5.5 -9.5,5.5" fill="#d4a254" />
      <polygon points="0,11 9.5,-5.5 -9.5,-5.5" fill="#e8bb6a" fillOpacity={0.85} />
      <circle r={2.6} fill="#120d0a" />
    </svg>
  );
}

/** The bar across every page. `children` sits beside the user menu. */
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
        >
          <StarMark />
          <span className="font-display text-lg font-semibold tracking-tight">Chinese Checkers</span>
        </Link>
        <div className="flex items-center gap-4">
          {children}
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
