-- Keep referral attribution callable by the trusted server-side signup route only.
-- The function runs as its caller; the signup route uses the Supabase service role.
create or replace function public.increment_referrals(code_input text)
returns void
language plpgsql
security invoker
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

revoke all privileges on function public.increment_referrals(text)
  from public, anon, authenticated;
grant execute on function public.increment_referrals(text) to service_role;
