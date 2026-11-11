-- Inbox.lv jauniešiem: aptaujas datubāze.
-- Pievieno JAUNAS tabulas un funkcijas ar prefiksu youth_. Esošās tabulas netiek aizskartas.
-- Droši palaist vairākkārt. Palaist Supabase: SQL Editor -> New query -> Run.
--
-- Drošība: tabulām ir ieslēgts RLS un NAV nevienas politikas, tāpēc ar publishable (anon)
-- atslēgu tām nevar piekļūt tieši. Anon drīkst izsaukt tikai trīs funkcijas:
--   submit_youth_feedback(p)  - ieraksta vienu atbildi (ar validāciju)
--   youth_public()            - visas atbildes BEZ brīvā teksta (statistikai)
--   youth_admin(p_key)        - visas atbildes AR komentāriem, tikai ar pareizu stats atslēgu

create table if not exists public.youth_feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  device      text not null default 'desktop' check (device in ('mobile','desktop')),
  age         text not null check (age in ('līdz 15','16-18','19-24','25+')),
  overall     smallint check (overall between 1 and 5),
  ideas       text[] not null default '{}',
  sections    jsonb not null default '{}'::jsonb,   -- {sadaļa: {vote, tags[]}}
  notes       jsonb not null default '{}'::jsonb,   -- {sadaļa: piezīme}  (privāts)
  comment     text                                   -- (privāts)
);
create index if not exists youth_feedback_created_idx on public.youth_feedback (created_at desc);
alter table public.youth_feedback enable row level security;

create table if not exists public.youth_settings (
  key   text primary key,
  value text not null
);
alter table public.youth_settings enable row level security;
revoke all on public.youth_feedback, public.youth_settings from public, anon, authenticated;

-- Atslēgas /stats/ komentāru atvēršanai glabājas kā SHA-256 hash (pati atslēga datubāzē nav).
-- Nomainīt: sha256 hex no jaunās atslēgas, piem.  node -e "console.log(require('crypto').createHash('sha256').update('JAUNA').digest('hex'))"
insert into public.youth_settings (key, value)
values ('stats_key_sha256', '7882d438136a3f2b1d63004b0271e2579a5a247cae022f57dbe1b5a96c82e08f')
on conflict (key) do nothing;

-- ---------- atbildes ierakstīšana ----------
create or replace function public.submit_youth_feedback(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_age      text := p->>'age';
  v_overall  int  := nullif(p->>'overall', '')::int;
  v_sections jsonb := '{}'::jsonb;
  v_notes    jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  if p is null or length(p::text) > 20000 then raise exception 'too large' using errcode = '22023'; end if;
  if v_age is null or v_age not in ('līdz 15','16-18','19-24','25+') then raise exception 'age required' using errcode = '22023'; end if;
  if v_overall is not null and (v_overall < 1 or v_overall > 5) then raise exception 'bad overall' using errcode = '22023'; end if;

  -- aizsardzība pret pārplūdi: ne vairāk kā 300 atbildes minūtē kopā
  if (select count(*) from public.youth_feedback where created_at > now() - interval '1 minute') >= 300 then
    raise exception 'rate limit' using errcode = '54000';
  end if;

  for k, v in select key, value from jsonb_each(case when jsonb_typeof(p->'sections') = 'object' then p->'sections' else '{}'::jsonb end) loop
    if v->>'vote' in ('like','ok','dislike') then
      v_sections := v_sections || jsonb_build_object(left(k, 30), jsonb_build_object(
        'vote', v->>'vote',
        'tags', case when jsonb_typeof(v->'tags') = 'array' then v->'tags' else '[]'::jsonb end));
      if coalesce(v->>'note', '') <> '' then
        v_notes := v_notes || jsonb_build_object(left(k, 30), left(v->>'note', 200));
      end if;
    end if;
  end loop;

  if v_sections = '{}'::jsonb and v_overall is null then raise exception 'empty' using errcode = '22023'; end if;

  insert into public.youth_feedback (device, age, overall, ideas, sections, notes, comment)
  values (
    case when p->>'device' = 'mobile' then 'mobile' else 'desktop' end,
    v_age,
    v_overall,
    coalesce(array(select left(x, 80) from jsonb_array_elements_text(case when jsonb_typeof(p->'ideas') = 'array' then p->'ideas' else '[]'::jsonb end) x limit 5), '{}'),
    v_sections,
    v_notes,
    nullif(left(coalesce(p->>'comment', ''), 600), '')
  );
end;
$$;

-- ---------- statistika bez brīvā teksta ----------
create or replace function public.youth_public()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'ts', created_at, 'device', device, 'age', age, 'overall', overall,
           'ideas', to_jsonb(ideas), 'sections', sections) order by created_at), '[]'::jsonb)
  from (select * from public.youth_feedback order by created_at desc limit 5000) t;
$$;

-- ---------- pilni dati ar komentāriem (tikai ar atslēgu) ----------
create or replace function public.youth_admin(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.youth_settings
    where key = 'stats_key_sha256'
      and value = encode(sha256(convert_to(coalesce(p_key, ''), 'utf8')), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'ts', created_at, 'device', device, 'age', age, 'overall', overall,
             'ideas', to_jsonb(ideas), 'sections', sections, 'notes', notes, 'comment', comment) order by created_at), '[]'::jsonb)
    from (select * from public.youth_feedback order by created_at desc limit 5000) t
  );
end;
$$;

revoke all on function public.submit_youth_feedback(jsonb) from public;
revoke all on function public.youth_public()               from public;
revoke all on function public.youth_admin(text)            from public;
grant execute on function public.submit_youth_feedback(jsonb) to anon, authenticated;
grant execute on function public.youth_public()               to anon, authenticated;
grant execute on function public.youth_admin(text)            to anon, authenticated;
