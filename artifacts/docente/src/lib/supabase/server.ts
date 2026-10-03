import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

// Server Components cannot write cookies; the proxy refreshes the session before render,
// and Server Actions / Route Handlers can write, so failures here are safe to ignore.
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component render.
        }
      },
    },
  });
}
