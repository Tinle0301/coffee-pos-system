// supabase-client.js
// Single Supabase client initializer for the data-access layer.
// PLACEHOLDER — reads env vars, does not hardcode any credentials.
//
// Usage: import { supabase } from './supabase-client.js'
//
// SUPABASE_URL and SUPABASE_ANON_KEY are safe to expose to the browser.
// The service_role key bypasses RLS entirely and must NEVER be used here
// or committed to this repo. See docs/SETUP.md.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL; // PLACEHOLDER — set in env
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // PLACEHOLDER — set in env

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
