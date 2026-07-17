import { createClient } from "@supabase/supabase-js";

// Public Supabase project URL + anon key — safe to ship in the client bundle
// (this is how Supabase's own client-side auth model works). Kept as hardcoded
// fallbacks so the app works out of the box on any Vercel project, with no
// dashboard env var setup required; NEXT_PUBLIC_* vars still override if set.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vsfmljbrqymbymiiyptx.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZm1samJycXltYnltaWl5cHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzA0MzAsImV4cCI6MjA5OTgwNjQzMH0.3pyxF8gQMfKPQTDks91U_YplMkUWyiVN7wAuU_LzTWw";

let client: ReturnType<typeof createClient> | null = null;

export function supabaseBrowser() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
