// Supabase client. Reads credentials from .env (VITE_SUPABASE_URL,
// VITE_SUPABASE_ANON_KEY). Copy .env.example to .env and fill them in.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True only when both env vars are present — lets the UI show a friendly
// "not configured" state instead of throwing on a missing client.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
