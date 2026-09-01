import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Landing point for the password-recovery email link. Supabase appends a
// `?code=...`; we exchange it for a session (setting auth cookies) and then
// send the user to the reset-password form. Cookies CAN be set here because a
// Route Handler is a full request/response context (unlike Server Components).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/forgot-password?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  return NextResponse.redirect(`${origin}/reset-password`);
}
