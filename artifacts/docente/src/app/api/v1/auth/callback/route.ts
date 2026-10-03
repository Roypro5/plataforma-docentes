import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/core/auth/routes";

const otpTypes: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Auth callback for OAuth (PKCE code) and email links (token hash). The only /api/v1
// surface in this stage; product operations use Server Actions.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    let ok = false;
    if (code) {
      ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
    } else if (tokenHash && type && otpTypes.includes(type)) {
      ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
    }
    if (ok) {
      // Minimal activity log; failures are ignored so they never block the sign-in.
      try {
        await supabase.rpc("record_session_started");
      } catch {
        // Ignored on purpose.
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/ingresar?error=enlace", url.origin));
}
