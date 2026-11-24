-- Align the waitlist table with the app's current referral logic.
-- This migration preserves referral tracking and ensures email uniqueness.

alter table public.waitlist
  add column if not exists referral_code text,
  add column if not exists referred_by text,
  add column if not exists referrals_count integer not null default 0;

-- Backfill values for any legacy rows that were created before referral support existed.
update public.waitlist
set referral_code = upper(substr(md5((id::text || '-' || coalesce(created_at::text, now()::text))), 1, 8))
where referral_code is null or referral_code = '';

-- Prevent duplicate signups regardless of email casing.
create unique index if not exists waitlist_email_unique_idx
  on public.waitlist (lower(email));

-- Optional: make the code column unique for referral lookup safety.
create unique index if not exists waitlist_referral_code_unique_idx
  on public.waitlist (referral_code)
where referral_code is not null;

-- RPC used by the server route: supabase.rpc('increment_referrals', { code_input: referralCode })
create or replace function public.increment_referrals(code_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if code_input is null or trim(code_input) = '' then
    return;
  end if;

  update public.waitlist
  set referrals_count = coalesce(referrals_count, 0) + 1
  where referral_code = upper(trim(code_input));
end;
$$;

grant execute on function public.increment_referrals(text) to authenticated;
grant execute on function public.increment_referrals(text) to anon;
