-- Gaismas dārza aptauja (/gaismasaptauja/). Safe to run more than once in the Supabase SQL editor.
-- The table is private (RLS on, no direct grants); the page only calls the two functions
-- below with the publishable key.
--
-- Safety rules enforced here, not in the browser:
--   * one answer per browser (voter_id); a browser can change its own answer and name
--   * a name already used by another browser cannot be taken over or overwritten
--   * names are cleaned (control and invisible characters removed, spaces collapsed, max 60)
--   * only the four poll dates are accepted
--   * names are shown only with the stats key; without it the stats page shows counts only
--   * rate limit (30 saves per minute in total) and a hard cap of 1000 responses
begin;

create table if not exists public.gaisma_responses (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null unique,
  name text not null check (char_length(name) between 1 and 60),
  name_key text not null unique,           -- lower-cased name: a name belongs to one person
  date_id text not null check (date_id in ('2026-12-06','2026-12-13','2026-12-20','2026-12-27')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade from the first version (no voter_id): give existing rows an id of their own.
alter table public.gaisma_responses add column if not exists voter_id uuid;
update public.gaisma_responses set voter_id = gen_random_uuid() where voter_id is null;
alter table public.gaisma_responses alter column voter_id set not null;
create unique index if not exists gaisma_responses_voter_id_key on public.gaisma_responses(voter_id);

alter table public.gaisma_responses enable row level security;
revoke all on public.gaisma_responses from public, anon, authenticated;

-- The first version took (name, date) only.
drop function if exists public.submit_gaisma_response(text, text);

-- Save or change this browser's answer. Returns 'created' or 'updated'.
create or replace function public.submit_gaisma_response(p_voter_id uuid, p_name text, p_date text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  clean_name text;
  v_key text;
  has_row boolean;
begin
  if p_voter_id is null then
    raise exception 'Invalid voter' using errcode = '22023';
  end if;
  clean_name := pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(coalesce(p_name, ''),
      '[[:cntrl:]\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]', ' ', 'g'),
    '\s+', ' ', 'g'));
  if pg_catalog.char_length(clean_name) not between 1 and 60 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  if p_date is null or p_date not in ('2026-12-06','2026-12-13','2026-12-20','2026-12-27') then
    raise exception 'Invalid date' using errcode = '22023';
  end if;
  v_key := pg_catalog.lower(clean_name);

  -- One writer at a time: keeps the checks below exact.
  perform pg_catalog.pg_advisory_xact_lock(7340213);

  if (select pg_catalog.count(*) from public.gaisma_responses
        where updated_at > pg_catalog.now() - interval '1 minute') >= 30 then
    raise exception 'Too many requests' using errcode = '54000';
  end if;

  select exists (select 1 from public.gaisma_responses where voter_id = p_voter_id) into has_row;

  if exists (select 1 from public.gaisma_responses r
               where r.name_key = v_key and r.voter_id <> p_voter_id) then
    raise exception 'Name taken' using errcode = 'P0001';
  end if;

  if has_row then
    update public.gaisma_responses r
      set name = clean_name, name_key = v_key,
          date_id = p_date, updated_at = pg_catalog.now()
      where r.voter_id = p_voter_id;
    return 'updated';
  end if;

  if (select pg_catalog.count(*) from public.gaisma_responses) >= 1000 then
    raise exception 'Poll is full' using errcode = '54000';
  end if;
  insert into public.gaisma_responses(voter_id, name, name_key, date_id)
    values (p_voter_id, clean_name, v_key, p_date);
  return 'created';
end;
$$;
revoke all on function public.submit_gaisma_response(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_gaisma_response(uuid, text, text) to anon;

-- Stats key: only its SHA-256 hash is stored (the key itself is not in the database or the repo).
-- To change it:  node -e "console.log(require('crypto').createHash('sha256').update('NEW-KEY').digest('hex'))"
-- then:  update public.gaisma_settings set value = '<hash>' where key = 'stats_key_sha256';
create table if not exists public.gaisma_settings (key text primary key, value text not null);
alter table public.gaisma_settings enable row level security;
revoke all on public.gaisma_settings from public, anon, authenticated;
insert into public.gaisma_settings(key, value) values ('stats_key_sha256', 'bb362f16fd9b2a486819ff0ff0bb01cf2bd3aba0dd0ce39a5260260706a87095')
  on conflict (key) do nothing;

-- The first version returned names to everyone.
drop function if exists public.get_gaisma_results();

-- Public: votes per date only, no names.
create or replace function public.get_gaisma_counts()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('date_id', c.date_id, 'votes', c.votes) order by c.date_id),
    '[]'::jsonb)
  from (select date_id, pg_catalog.count(*) as votes from public.gaisma_responses group by date_id) c;
$$;
revoke all on function public.get_gaisma_counts() from public, anon, authenticated;
grant execute on function public.get_gaisma_counts() to anon;

-- Names: only with the correct stats key. voter_id is never returned.
create or replace function public.get_gaisma_results(p_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gaisma_settings
    where key = 'stats_key_sha256'
      and value = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p_key, ''), 'utf8')), 'hex')
  ) then
    perform pg_catalog.pg_sleep(0.5);
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  return (select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', r.name, 'date_id', r.date_id) order by r.name),
    '[]'::jsonb) from public.gaisma_responses r);
end;
$$;
revoke all on function public.get_gaisma_results(text) from public, anon, authenticated;
grant execute on function public.get_gaisma_results(text) to anon;

commit;

-- Removing a response (run manually when needed):
--   delete from public.gaisma_responses where name_key = lower('Anna Bērziņa');
-- Full list for export:
--   select date_id, name from public.gaisma_responses order by date_id, name;
