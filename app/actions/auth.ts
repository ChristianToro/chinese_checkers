"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { endSession, startSession } from "@/lib/session";
import { type SignupErrors, createUser, validateSignup, verifyCredentials } from "@/lib/users-repo";

export interface AuthFormState {
  errors?: SignupErrors;
  message?: string;
  /** Echoed back so the form keeps what was typed after a failed submit. */
  values?: { username: string; avatar: string };
}

function echo(formData: FormData): AuthFormState["values"] {
  return {
    username: String(formData.get("username") ?? ""),
    avatar: String(formData.get("avatar") ?? ""),
  };
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const result = validateSignup({
    username: formData.get("username"),
    password: formData.get("password"),
    avatar: formData.get("avatar"),
  });
  if (!result.ok) return { errors: result.errors, values: echo(formData) };

  const user = await createUser(result.value);
  if (!user) {
    return { errors: { username: "That username is taken" }, values: echo(formData) };
  }

  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = formData.get("username");
  const password = formData.get("password");
  const user =
    typeof username === "string" && typeof password === "string"
      ? await verifyCredentials(username, password)
      : null;
  // One message for both cases, so the form doesn't reveal which names exist.
  if (!user) return { message: "Wrong username or password", values: echo(formData) };

  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}
