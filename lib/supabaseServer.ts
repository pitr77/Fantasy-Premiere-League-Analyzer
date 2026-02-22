import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for use in API routes and server components.
 * Uses NEXT_PUBLIC_ keys (anon) but runs on the server to avoid CORS issues.
 */
export function createServerSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key);
}
