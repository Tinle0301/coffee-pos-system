-- ci_auth_shim.sql
-- Makes plain PostgreSQL behave enough like Supabase to run our RLS tests.
--
-- Our policies call auth.uid(), and clients connect as the roles `anon` or
-- `authenticated`. Supabase provides all of that. A bare Postgres container
-- (what CI runs) does not, so migration 0002 would fail with
-- "schema auth does not exist".
--
-- Apply this BEFORE the migrations when testing against plain Postgres.
-- Never apply it to the real Supabase project — it would shadow the real one.

create schema if not exists auth;

-- Supabase sets request.jwt.claims on each request; auth.uid() reads the
-- subject out of it. Same contract, minimal implementation.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', 'anon');
$$;

-- The two roles the Data API connects as.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public, auth to anon, authenticated;

-- Supabase grants table privileges to these roles and lets RLS decide the
-- rows. Mirror that here, applied after migrations by the CI workflow.
