// Public Supabase settings. Both values are safe for the browser: data access is
// protected by RLS. Without them the app renders an explicit "Auth not configured"
// state instead of simulating sessions.
export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
