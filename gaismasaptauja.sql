-- Gaismas dārza aptauja (/gaismasaptauja/). Run once in the Supabase SQL editor.
-- Same pattern as the theme poll: the table is private (RLS on, no direct grants);
-- the page only calls the two functions below with the publishable key.
begin;

create table if not exists public.gaisma_responses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  name_key text not null unique,           -- lower-cased name: one answer per person
  date_id text not null check (date_id in ('2026-12-06','2026-12-13','2026-12-20','2026-12-27')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gaisma_responses enable row level security;
revoke all on public.gaisma_responses from public, anon, authenticated;

-- Save or change one person's answer. Returns 'created' or 'updated'.
create or replace function public.submit_gaisma_response(p_name text, p_date text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  clean_name text;
  was_insert boolean;
begin
  clean_name := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if pg_catalog.char_length(clean_name) not between 1 and 60 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  if p_date is null or p_date not in ('2026-12-06','2026-12-13','2026-12-20','2026-12-27') then
    raise exception 'Invalid date' using errcode = '22023';
  end if;
  insert into public.gaisma_responses(name, name_key, date_id)
    values (clean_name, pg_catalog.lower(clean_name), p_date)
    on conflict (name_key) do update
      set name = excluded.name, date_id = excluded.date_id, updated_at = pg_catalog.now()
    returning (xmax = 0) into was_insert;
  return case when was_insert then 'created' else 'updated' end;
end;
$$;
revoke all on function public.submit_gaisma_response(text, text) from public, anon, authenticated;
grant execute on function public.submit_gaisma_response(text, text) to anon;

-- Everyone with the link sees who picked which date (same as the original page).
create or replace function public.get_gaisma_results()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('name', r.name, 'date_id', r.date_id) order by r.name),
    '[]'::jsonb)
  from public.gaisma_responses r;
$$;
revoke all on function public.get_gaisma_results() from public, anon, authenticated;
grant execute on function public.get_gaisma_results() to anon;

commit;

-- Removing a response (run manually when needed):
--   delete from public.gaisma_responses where name_key = lower('Anna Bērziņa');
-- Full list for export:
--   select date_id, name from public.gaisma_responses order by date_id, name;
