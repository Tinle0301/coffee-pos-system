// config.js — Supabase connection settings for the browser
//
// WHY THIS FILE EXISTS: we chose vanilla HTML/CSS/JS (FRONTEND_DECISION.md
// option A), which means NO build step. Nothing rewrites `process.env` into
// the bundle, because there is no bundle — the browser loads these files as
// they are. So the values live here, in plain sight.
//
// IS THAT SAFE? Yes, and only for these two values:
//   - the project URL is public by definition
//   - the PUBLISHABLE key is designed to ship in browser code
// What actually protects the data is the Row Level Security policies in
// backend/migrations/0002_rls_policies.sql. The key gets you to the door;
// the policies decide what you may read.
//
// NEVER put a secret key here (sb_secret_... or the legacy service_role).
// Those bypass RLS entirely. This repo is public.

export const SUPABASE_URL = 'https://inwlmodlxpcajgivmlbr.supabase.co';

// TODO(Tin): paste the sb_publishable_... key from
// Supabase → Settings → API Keys → "Publishable and secret API keys"
export const SUPABASE_PUBLISHABLE_KEY = 'PASTE_PUBLISHABLE_KEY_HERE';
