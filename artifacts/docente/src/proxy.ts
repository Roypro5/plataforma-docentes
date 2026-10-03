import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isProtectedPath } from "@/core/auth/routes";

// Refreshes the Supabase session before rendering and sends anonymous visitors of
// private pages to sign in. Authorization itself is enforced by Server Actions and RLS.
export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  let signedIn = false;
  if (config) {
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(toSet, headers) {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    const { data } = await supabase.auth.getClaims();
    signedIn = !!data?.claims?.sub;
  }

  if (isProtectedPath(path) && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isProtectedPath(path)) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|icon.svg|robots.txt).*)"],
};
