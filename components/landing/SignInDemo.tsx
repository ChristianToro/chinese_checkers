"use client";

import { useEffect, useState } from "react";
import Avatar from "../Avatar";
import { MarbleDot } from "../board-art";
import { buttonPrimary } from "../ui";
import { useMotionGate } from "./DemoPlayback";

const USERNAME = "mei";
const PASSWORD_LENGTH = 10;

interface Frame {
  /** Characters typed so far in each field. */
  user: number;
  pass: number;
  focus: "username" | "password" | null;
  stage: "typing" | "submitting" | "seated";
  /** How long the frame shows before the next one. */
  ms: number;
}

/** One loop of someone logging in: type the name, type the password, submit, seated. */
const FRAMES: readonly Frame[] = [
  { user: 0, pass: 0, focus: "username", stage: "typing", ms: 800 },
  ...Array.from({ length: USERNAME.length }, (_, i): Frame => ({
    user: i + 1,
    pass: 0,
    focus: "username",
    stage: "typing",
    ms: i + 1 === USERNAME.length ? 450 : 150,
  })),
  { user: USERNAME.length, pass: 0, focus: "password", stage: "typing", ms: 300 },
  ...Array.from({ length: PASSWORD_LENGTH }, (_, i): Frame => ({
    user: USERNAME.length,
    pass: i + 1,
    focus: "password",
    stage: "typing",
    ms: i + 1 === PASSWORD_LENGTH ? 450 : 85,
  })),
  { user: USERNAME.length, pass: PASSWORD_LENGTH, focus: null, stage: "submitting", ms: 1000 },
  { user: USERNAME.length, pass: PASSWORD_LENGTH, focus: null, stage: "seated", ms: 2600 },
];

/** Shown instead of the loop under prefers-reduced-motion. */
const STILL = FRAMES.length - 1;

function FakeField({ label, value, focused }: { label: string; value: string; focused: boolean }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div
        className={`flex h-[42px] items-center rounded-lg border bg-ink/60 px-3 text-base transition ${
          focused ? "border-brass ring-2 ring-brass/30" : "border-line"
        }`}
      >
        <span className="whitespace-pre">{value}</span>
        {focused && <span className="ml-px h-5 w-px animate-caret bg-cream" />}
      </div>
    </div>
  );
}

/** An illustration of step 1: the log in form filling itself in, on a loop. */
export default function SignInDemo() {
  const { reduced, hidden } = useMotionGate();
  const [index, setIndex] = useState(0);
  const frame = FRAMES[reduced ? STILL : index];

  useEffect(() => {
    if (reduced || hidden) return;
    const timer = window.setTimeout(
      () => setIndex((i) => (i + 1) % FRAMES.length),
      FRAMES[index].ms,
    );
    return () => window.clearTimeout(timer);
  }, [index, reduced, hidden]);

  const seated = frame.stage === "seated";

  return (
    <figure aria-label="Example log in" className="space-y-4">
      {/* The typing changes every few milliseconds; the caption says what it shows. */}
      <div aria-hidden className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink/60 p-1 text-center text-sm font-semibold">
          <span className="rounded-lg px-3 py-2 text-muted">Create account</span>
          <span className="rounded-lg bg-raised px-3 py-2 text-cream shadow-sm">Log in</span>
        </div>
        <FakeField
          label="Username"
          value={USERNAME.slice(0, frame.user)}
          focused={frame.focus === "username"}
        />
        <FakeField
          label="Password"
          value={"•".repeat(frame.pass)}
          focused={frame.focus === "password"}
        />
        <div
          className={`${buttonPrimary} w-full px-6 py-3 text-center text-lg ${
            frame.stage === "submitting" ? "scale-[0.98] opacity-60" : ""
          }`}
        >
          {frame.stage === "submitting" ? "Logging in…" : "Log in"}
        </div>
        <div
          className={`flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2 ${
            seated ? "animate-row-in" : "invisible"
          }`}
        >
          <Avatar avatar="panda" size={28} />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{USERNAME}</span> took a seat
          </span>
          <MarbleDot color="ruby" />
        </div>
      </div>
      <figcaption className="text-xs leading-relaxed text-muted">
        Simulated log in. A free account is a username, a password and an avatar.
      </figcaption>
    </figure>
  );
}
