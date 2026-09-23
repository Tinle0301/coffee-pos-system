// supabase-client.js — the single Supabase client for the whole app.
//
// Imported by every module in backend/services/. The frontend never imports
// this directly — it goes through the service modules (see REPO-MAP.md).
//
// The library is loaded from a CDN as an ES module because we have no build
// step (vanilla JS, FRONTEND_DECISION.md option A).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

if (!SUPABASE_URL || SUPABASE_PUBLISHABLE_KEY === 'PASTE_PUBLISHABLE_KEY_HERE') {
  // Fail loudly and early: a missing key otherwise shows up as mysterious
  // empty results much later, which is hard to tell apart from a missing
  // RLS policy.
  throw new Error(
    'Supabase is not configured. Set SUPABASE_PUBLISHABLE_KEY in backend/config.js — see docs/SETUP.md.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,      // a refresh mid-shift must not log the barista out
    autoRefreshToken: true,
    detectSessionInUrl: false, // we use email/password, not magic links
  },
});
