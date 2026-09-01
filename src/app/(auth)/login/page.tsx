import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login | Dashboard",
};

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to access the dashboard">
      <LoginForm redirectTo={redirect ?? "/dashboard"} />
    </AuthShell>
  );
}
