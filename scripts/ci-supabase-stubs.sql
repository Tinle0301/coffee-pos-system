-- ci-supabase-stubs.sql — POS-42
--
-- Our migrations are written for Supabase, which already has the auth
-- schema, auth.uid(), the anon / authenticated / service_role roles and the
-- supabase_realtime publication. A plain Postgres database (the one CI
-- starts, or a local one) has none of these, so the migrations would fail.
-- This file adds just enough of them for the migrations and the
-- backend/tests/*.sql check files to run the same way they do on Supabase.
--
-- Only for CI and local testing. Never run this against the live project.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- the check files switch to these roles with "set local role"
grant anon, authenticated, service_role to current_user;

create schema if not exists auth;

-- Supabase reads the signed-in user from the request's JWT claims; the
-- check files set those claims with set_config('request.jwt.claims', ...).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Supabase gives these roles table and function access by default and lets
-- RLS decide what they can see; copy that so RLS is what gets tested.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
