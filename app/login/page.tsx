import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { eyebrow } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Take a seat · Chinese Checkers",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-20 pt-12 sm:pt-16">
        <p className={eyebrow}>Pull up a chair</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Take a seat</h1>
        <p className="mt-2 text-muted">
          Make a free account or log in, then open a table and send the link.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="py-8 text-muted">Loading…</p>}>
            <SignIn searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

/** The account form. Someone already signed in goes straight on to `next`. */
async function SignIn({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect(safeNext(next));
  return <AuthForm next={typeof next === "string" ? next : undefined} />;
}
