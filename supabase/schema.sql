-- ============================================================================
--  Youman Automation — SaaS schema (Supabase / Postgres)
--  Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (plan, billing, monthly usage counters)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  email                  text,
  full_name              text,
  plan                   text not null default 'free',
  subscription_status    text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  search_count           integer not null default 0,
  email_count            integer not null default 0,
  usage_period           text,                 -- 'YYYY-MM'
  created_at             timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- Create a profile row automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- consume_quota: atomically reset monthly counters + check/charge a credit.
-- Returns true when allowed (and increments), false when the limit is hit.
-- ---------------------------------------------------------------------------
create or replace function public.consume_quota(p_kind text, p_limit integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cur_period text := to_char(now(), 'YYYY-MM');
  used integer;
begin
  -- Reset counters at the start of a new month.
  update public.profiles
     set search_count = case when usage_period is distinct from cur_period then 0 else search_count end,
         email_count  = case when usage_period is distinct from cur_period then 0 else email_count  end,
         usage_period = cur_period
   where id = auth.uid();

  if p_kind = 'search' then
    select search_count into used from public.profiles where id = auth.uid();
    if used >= p_limit then return false; end if;
    update public.profiles set search_count = search_count + 1 where id = auth.uid();
  elsif p_kind = 'email' then
    select email_count into used from public.profiles where id = auth.uid();
    if used >= p_limit then return false; end if;
    update public.profiles set email_count = email_count + 1 where id = auth.uid();
  else
    return false;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- leads: companies the user saved from Felix's results
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  address      text,
  phone        text,
  website      text,
  has_website  boolean,
  descriptors  text[],
  email        text,
  status       text default 'neu',
  created_at   timestamptz not null default now()
);

alter table public.leads enable row level security;
drop policy if exists "leads own" on public.leads;
create policy "leads own" on public.leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sent_emails: log of pitch e-mails Paul sent
-- ---------------------------------------------------------------------------
create table if not exists public.sent_emails (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  to_email    text not null,
  subject     text,
  company     text,
  created_at  timestamptz not null default now()
);

alter table public.sent_emails enable row level security;
drop policy if exists "sent_emails own" on public.sent_emails;
create policy "sent_emails own" on public.sent_emails for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
