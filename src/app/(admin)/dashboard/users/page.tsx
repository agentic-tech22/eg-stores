import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { listUsers } from "@/services/user.service";
import { UserManager } from "./UserManager";

export default async function UsersPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard");

  let users: Awaited<ReturnType<typeof listUsers>> = [];
  try {
    users = await listUsers();
  } catch {
    // Fallback to empty; the page still renders the invite form.
  }

  return <UserManager initialUsers={users} currentUserId={ctx.userId} />;
}
