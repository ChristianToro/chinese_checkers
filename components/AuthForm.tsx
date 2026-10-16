"use client";

import { useActionState, useState } from "react";
import { type AuthFormState, login, signup } from "@/app/actions/auth";
import { AVATARS, AVATAR_LABELS } from "@/lib/avatars";
import Avatar from "./Avatar";
import { buttonPrimary, card, fieldError, input } from "./ui";

const submitClass = `${buttonPrimary} w-full px-6 py-3 text-lg`;

type Mode = "signup" | "login";

/** Create account / log in, for the /login page. */
export default function AuthForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<Mode>("signup");
  return (
    <section className={`${card} w-full max-w-md p-6 text-left`}>
      <div role="tablist" aria-label="Account" className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink/60 p-1">
        {(
          [
            ["signup", "Create account"],
            ["login", "Log in"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={mode === value}
            aria-controls={`panel-${value}`}
            onClick={() => setMode(value)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-brass ${
              mode === value ? "bg-raised text-cream shadow-sm" : "text-muted hover:text-cream"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
        {mode === "signup" ? <SignupForm next={next} /> : <LoginForm next={next} />}
      </div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={`mt-1 ${fieldError}`}>
      {message}
    </p>
  );
}

function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});
  const errors = state.errors ?? {};
  const chosen = state.values?.avatar || AVATARS[0];

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="signup-username" className="mb-1 block text-sm font-medium">
          Username
        </label>
        <input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          defaultValue={state.values?.username}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? "signup-username-error" : "signup-username-hint"}
          className={input}
        />
        {errors.username ? (
          <FieldError id="signup-username-error" message={errors.username} />
        ) : (
          <p id="signup-username-hint" className="mt-1 text-xs text-muted">
            3–20 letters, numbers, dashes or underscores.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="signup-password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
          className={input}
        />
        {errors.password ? (
          <FieldError id="signup-password-error" message={errors.password} />
        ) : (
          <p id="signup-password-hint" className="mt-1 text-xs text-muted">
            At least 8 characters.
          </p>
        )}
      </div>
      <fieldset aria-describedby={errors.avatar ? "signup-avatar-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">Avatar</legend>
        <div className="grid grid-cols-5 gap-2">
          {AVATARS.map((avatar) => (
            <label
              key={avatar}
              title={AVATAR_LABELS[avatar]}
              className="cursor-pointer rounded-full p-0.5 ring-2 ring-transparent transition hover:ring-brass/40 has-[:checked]:ring-brass has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass"
            >
              <input
                type="radio"
                name="avatar"
                value={avatar}
                defaultChecked={avatar === chosen}
                className="sr-only"
              />
              <Avatar avatar={avatar} size={64} alt={AVATAR_LABELS[avatar]} className="h-auto w-full" />
            </label>
          ))}
        </div>
        <FieldError id="signup-avatar-error" message={errors.avatar} />
      </fieldset>
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}

function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="login-username" className="mb-1 block text-sm font-medium">
          Username
        </label>
        <input
          id="login-username"
          name="username"
          autoComplete="username"
          required
          defaultValue={state.values?.username}
          className={input}
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </div>
      {state.message && (
        <p role="alert" className={fieldError}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
