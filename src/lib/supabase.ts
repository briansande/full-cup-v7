import { createClient } from "@supabase/supabase-js";

/**
 * Basic Supabase client for Full Cup.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY which are
 * safe to expose to the browser (they are prefixed with NEXT_PUBLIC_).
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // This will appear in server logs during build / server-side render.
  // Client-side the variables should be available via Next.js environment injection.
  // We don't throw here so the app can still start; the connection test will surface an error.
  // eslint-disable-next-line no-console
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

/**
 * Simple connection test.
 * We call a lightweight auth endpoint (`getSession`) — if the request completes
 * without a network error then we consider the Supabase connection reachable.
 *
 * Returns { ok: boolean, error?: any }
 */
export async function testConnection(): Promise<{ ok: boolean; error?: any }> {
  try {
    const { error } = await supabase.auth.getSession();
    // If error is present the request reached Supabase but something failed.
    if (error) {
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}