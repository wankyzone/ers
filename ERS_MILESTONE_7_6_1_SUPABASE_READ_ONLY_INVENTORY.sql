-- ERS Milestone 7.6.1: live identity/schema inventory
-- MANUAL ONLY: run in the Supabase SQL Editor with an authorized read-only
-- inspection context. This file is not a migration and must not be applied.
-- Every executable statement below is SELECT-only. Do not paste customer
-- rows or secrets into a report. Queries return catalog metadata or aggregate
-- counts; no names, email addresses, phone numbers, KYC values, or tokens.
--
-- Run each section independently. If a live relation/column differs from the
-- checked-in snapshots, record that fact and skip/adapt only the affected
-- aggregate query. The catalog queries should run before the data aggregates.

-- 1. Relevant relations and columns (names/types/defaults only).
select
  c.table_schema,
  c.table_name,
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns as c
where c.table_schema in ('public', 'auth')
  and (
    c.table_name in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events', 'errand_logs',
      'jobs', 'user_devices', 'otp_codes', 'transactions', 'payments'
    )
    or c.table_name ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by c.table_schema, c.table_name, c.ordinal_position;

-- 2. Relation owner, RLS enabled/forced, and relation kind.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  pg_get_userbyid(c.relowner) as owner_name,
  c.relkind as relation_kind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname in ('public', 'auth')
  and (
    c.relname in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events', 'errand_logs',
      'jobs', 'user_devices', 'otp_codes', 'transactions', 'payments'
    )
    or c.relname ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by n.nspname, c.relname;

-- 3. Primary, unique, foreign-key, check, and exclusion constraints.
select
  n.nspname as schema_name,
  r.relname as relation_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  con.convalidated as is_validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint as con
join pg_class as r on r.oid = con.conrelid
join pg_namespace as n on n.oid = r.relnamespace
where n.nspname in ('public', 'auth')
  and (
    r.relname in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events', 'errand_logs',
      'jobs', 'user_devices', 'otp_codes', 'transactions', 'payments'
    )
    or r.relname ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by n.nspname, r.relname, con.conname;

-- 4. Index definitions for relevant relations.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and (
    tablename in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events'
    )
    or tablename ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by schemaname, tablename, indexname;

-- 5. Every policy on relevant public tables, including policy mode, commands,
-- target roles, USING and WITH CHECK expressions.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and (
    tablename in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events'
    )
    or tablename ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by tablename, policyname;

-- 6. Direct table-level grants for relevant public tables.
select
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and (
    table_name in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events'
    )
    or table_name ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by table_name, grantee, privilege_type;

-- 7. Column-level grants. These are important where broad table grants have
-- been partially revoked or particular role fields are writable.
select
  grantee,
  table_schema,
  table_name,
  column_name,
  privilege_type,
  is_grantable
from information_schema.column_privileges
where table_schema = 'public'
  and (
    table_name in (
      'profiles', 'runners', 'kyc_profiles', 'audit_logs',
      'errands', 'users', 'wallets', 'errand_events'
    )
    or table_name ilike any (array[
      '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
      '%audit%', '%approval%', '%application%', '%profile%'
    ])
  )
order by table_name, grantee, column_name, privilege_type;

-- 8. Triggers on auth.users and relevant public relations. Function body is
-- intentionally omitted; this query reports owner, SECURITY DEFINER and
-- search_path metadata without exposing application data.
select
  tn.nspname as table_schema,
  t.relname as table_name,
  tg.tgname as trigger_name,
  pg_get_triggerdef(tg.oid, true) as trigger_definition,
  pn.nspname as function_schema,
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_trigger as tg
join pg_class as t on t.oid = tg.tgrelid
join pg_namespace as tn on tn.oid = t.relnamespace
join pg_proc as p on p.oid = tg.tgfoid
join pg_namespace as pn on pn.oid = p.pronamespace
where not tg.tgisinternal
  and (
    (tn.nspname = 'auth' and t.relname = 'users')
    or (
      tn.nspname = 'public'
      and (
        t.relname in (
          'profiles', 'runners', 'kyc_profiles', 'audit_logs',
          'errands', 'users', 'wallets', 'errand_events'
        )
        or t.relname ilike any (array[
          '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
          '%audit%', '%approval%', '%application%', '%profile%'
        ])
      )
    )
  )
order by tn.nspname, t.relname, tg.tgname;

-- 9. Function metadata and effective EXECUTE privilege for Supabase roles.
-- Function definitions are not selected.
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname in ('public', 'auth')
  and (
    p.proname ilike any (array[
      '%user%', '%profile%', '%role%', '%runner%', '%kyc%',
      '%admin%', '%audit%', '%approval%', '%application%'
    ])
  )
order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

-- 10. Migration-history relation presence. This does not read or modify rows.
select to_regclass('supabase_migrations.schema_migrations') as migration_history_relation;

-- 10a. Run only if the previous query confirms the relation exists.
-- This is still SELECT-only. If the table uses a different schema/name or
-- columns, inspect its columns using query 1 before adapting this read.
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 11. Aggregate identity counts only. No user-level details are returned.
-- These queries assume the relevant columns match the checked-in snapshots.
select count(*) as auth_user_count
from auth.users;

select role, count(*) as profile_count
from public.profiles
group by role
order by role nulls first;

select role, count(*) as public_user_count
from public.users
group by role
order by role nulls first;

select
  count(*) as profile_count,
  count(*) filter (where au.id is not null) as profiles_with_auth_identity,
  count(*) filter (where au.id is null) as profiles_without_auth_identity
from public.profiles as p
left join auth.users as au on au.id = p.id;

select
  count(*) as auth_user_count,
  count(*) filter (where au.email_confirmed_at is not null) as email_confirmed_count,
  count(*) filter (where au.email_confirmed_at is null) as not_email_confirmed_count,
  count(*) filter (where p.id is not null) as users_with_profile_count,
  count(*) filter (where p.id is null) as users_without_profile_count
from auth.users as au
left join public.profiles as p on p.id = au.id;

select count(*) as runner_record_count
from public.runners;

select
  count(*) as runner_records,
  count(*) filter (where p.role = 'runner') as matching_profiles_with_runner_role,
  count(*) filter (where p.id is not null and p.role is distinct from 'runner')
    as matching_profiles_without_runner_role,
  count(*) filter (where p.id is null) as runner_records_without_profile
from public.runners as r
left join public.profiles as p on p.id = r.id;

select
  count(*) as runner_count,
  count(*) filter (where r.is_available is true) as marked_available_count,
  count(*) filter (where r.is_available is false) as marked_unavailable_count,
  count(*) filter (where u.id is not null) as runner_ids_matching_public_users,
  count(*) filter (where u.id is null) as runner_ids_without_public_user
from public.runners as r
left join public.users as u on u.id = r.id;

select status, count(*) as kyc_record_count
from public.kyc_profiles
group by status
order by status nulls first;

select
  count(*) as kyc_record_count,
  count(*) filter (where p.id is not null) as kyc_ids_matching_profiles,
  count(*) filter (where p.id is null) as kyc_ids_without_profiles,
  count(*) filter (where u.id is not null) as kyc_ids_matching_public_users,
  count(*) filter (where u.id is null) as kyc_ids_without_public_users
from public.kyc_profiles as k
left join public.profiles as p on p.id = k.user_id
left join public.users as u on u.id = k.user_id;

select
  count(*) as profile_count,
  count(*) filter (where role = 'admin') as profile_admin_role_count,
  count(*) filter (where role = 'runner') as profile_runner_role_count,
  count(*) filter (where role is null) as profile_null_role_count,
  count(*) filter (
    where role is not null
      and role not in ('client', 'runner', 'admin')
  ) as profile_unexpected_role_count
from public.profiles;

select
  count(*) as public_user_count,
  count(*) filter (where role = 'admin') as public_user_admin_role_count,
  count(*) filter (where role = 'runner') as public_user_runner_role_count,
  count(*) filter (where role is null) as public_user_null_role_count,
  count(*) filter (
  where role is not null
    and role not in ('client', 'runner', 'admin')
  ) as public_user_unexpected_role_count
from public.users;

-- 12. Presence/count of named identity-related tables (not row contents).
select
  table_schema,
  table_name
from information_schema.tables
where table_schema in ('public', 'auth', 'supabase_migrations')
  and table_type = 'BASE TABLE'
  and table_name ilike any (array[
    '%identity%', '%role%', '%runner%', '%kyc%', '%admin%',
    '%audit%', '%approval%', '%application%', '%profile%',
    '%schema_migrations%'
  ])
order by table_schema, table_name;
