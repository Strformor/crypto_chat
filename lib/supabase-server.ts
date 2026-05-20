import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase admin client.
 * Uses the service_role key which bypasses RLS entirely.
 *
 * NEVER import this in a client component or use NEXT_PUBLIC_ env vars here.
 * This file must only be imported by Next.js API routes (app/api/**).
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
