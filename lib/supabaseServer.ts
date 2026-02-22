import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for use in API routes and server components.
 * Optionally accepts an access token to authenticate the user.
 */
export function createServerSupabase(accessToken?: string) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (accessToken) {
        return createClient(url, key, {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });
    }

    return createClient(url, key);
}
