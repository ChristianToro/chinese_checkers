import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";
import Avatar from "./Avatar";

/** Who's signed in, with a way out. Reads the session: render behind <Suspense>. */
export default async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Avatar avatar={user.avatar} size={28} />
      <span className="hidden font-medium sm:inline">{user.username}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg px-2 py-1 text-muted transition hover:bg-raised hover:text-cream focus-visible:outline-2 focus-visible:outline-brass"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
