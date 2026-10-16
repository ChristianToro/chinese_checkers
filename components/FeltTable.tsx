import type { ReactNode } from "react";

/** The green felt table a board sits on. */
export default function FeltTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex w-full justify-center rounded-[2rem] bg-felt bg-[radial-gradient(ellipse_at_50%_35%,rgb(255_255_255/0.07),transparent_65%)] shadow-[inset_0_0_80px_rgb(0_0_0/0.55),0_30px_60px_-30px_rgb(0_0_0/0.9)] ring-1 ring-line ${className}`}
    >
      {children}
    </div>
  );
}
