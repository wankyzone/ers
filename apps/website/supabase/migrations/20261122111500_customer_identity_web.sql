begin;

alter table public.profiles
  add column if not exists full_name text;

alter table public.profiles
  alter column role set default 'client';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_auth_user_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_fkey
      foreign key (id) references auth.users(id)
      on delete cascade
      not valid;
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 100),
    'client'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "Allow insert own profile" on public.profiles;
drop policy if exists "Allow select own profile" on public.profiles;
drop policy if exists "Allow users to insert own profile" on public.profiles;
drop policy if exists "Profiles: read own" on public.profiles;
drop policy if exists "Profiles: update own" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "allow_insert_for_authenticator" on public.profiles;
drop policy if exists "allow_insert_from_trigger" on public.profiles;
drop policy if exists "allow_profile_insert" on public.profiles;
drop policy if exists "profiles_insert_authenticated" on public.profiles;

alter table public.profiles enable row level security;

create policy customer_profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy customer_profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and role = 'client'
  );

create policy customer_profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant insert (id, full_name, role) on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

commit;
