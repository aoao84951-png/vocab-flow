-- Run once in the project's Supabase SQL editor. Server service-role access only.
create table if not exists public.azure_tts_usage (
  month date primary key,
  used integer not null default 0 check (used >= 0 and used <= 500000)
);
create table if not exists public.azure_tts_audio (
  cache_key text primary key,
  audio_base64 text not null,
  created_at timestamptz not null default now()
);
alter table public.azure_tts_usage enable row level security;
alter table public.azure_tts_audio enable row level security;
revoke all on public.azure_tts_usage, public.azure_tts_audio from anon, authenticated;
grant all on public.azure_tts_usage, public.azure_tts_audio to service_role;

create or replace function public.reserve_azure_tts(p_characters integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_month date := date_trunc('month', now() at time zone 'UTC')::date;
  affected integer;
begin
  if p_characters is null or p_characters < 1 or p_characters > 500000 then
    return false;
  end if;
  insert into public.azure_tts_usage(month, used) values (current_month, 0)
    on conflict (month) do nothing;
  -- The conditional UPDATE holds a row lock: simultaneous devices cannot overspend.
  update public.azure_tts_usage set used = used + p_characters
    where month = current_month and used + p_characters <= 500000;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.reserve_azure_tts(integer) from public, anon, authenticated;
grant execute on function public.reserve_azure_tts(integer) to service_role;
