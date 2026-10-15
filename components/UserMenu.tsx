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
      <span className="font-medium">{user.username}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-lg px-2 py-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
