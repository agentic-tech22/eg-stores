import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { getManagedUser } from "@/services/user.service";
import { fetchUserRecords } from "@/services/user-records.service";
import type { UserHrRecords } from "@/types/user-record.types";
import { UserDetailClient } from "./UserDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) redirect("/dashboard");

  const user = await getManagedUser(id);
  if (!user) notFound();

  let records: UserHrRecords = {
    documents: [],
    salaryRecords: [],
    notes: [],
  };
  try {
    records = await fetchUserRecords(id);
  } catch {
    // Non-fatal: render the profile with empty sections.
  }

  return (
    <UserDetailClient
      user={user}
      initialRecords={records}
      currency={await getActiveCurrency()}
    />
  );
}
