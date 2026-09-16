-- grant_api_roles.sql
-- Run AFTER the migrations when testing on plain Postgres.
-- Gives anon/authenticated the same table privileges Supabase grants, so RLS
-- policies (not missing GRANTs) are what decides the outcome of every test.

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
