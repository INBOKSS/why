begin;
-- Keep and verify every existing saved response before adding history.
lock table public.theme_votes in share row exclusive mode;
create temporary table vote_history_before on commit drop as
  select voter_id, created_at, updated_at, choices, age_group, gender from public.theme_votes;

create table if not exists public.theme_vote_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.theme_votes(voter_id),
  vote_number integer not null check (vote_number > 0),
  created_at timestamptz not null default now(),
  choices text[] not null check (cardinality(choices) between 1 and 48),
  age_group text check (age_group in ('under_18','18_24','25_34','35_44','45_54','55_64','65_plus')),
  gender text check (gender in ('woman','man','other')),
  unique (voter_id, vote_number)
);
alter table public.theme_vote_submissions enable row level security;
revoke all on public.theme_vote_submissions from public, anon, authenticated;
alter table public.theme_votes add column if not exists submission_count integer not null default 0;

-- Earlier software kept only the latest answer. Preserve that known answer as #1.
-- Previously replaced answers cannot be reconstructed.
insert into public.theme_vote_submissions(voter_id,vote_number,created_at,choices,age_group,gender)
select v.voter_id,1,v.updated_at,v.choices,v.age_group,v.gender from public.theme_votes v
where not exists (select 1 from public.theme_vote_submissions s where s.voter_id=v.voter_id)
on conflict (voter_id,vote_number) do nothing;
update public.theme_votes v set submission_count = (
  select count(*) from public.theme_vote_submissions s where s.voter_id=v.voter_id
);

create or replace function public.record_theme_vote(
  p_voter_id uuid, p_submission_id uuid, p_choices text[],
  p_age_group text default null, p_gender text default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare response_number integer;
begin
  if p_voter_id is null or p_submission_id is null or p_choices is null
    or cardinality(p_choices) not between 4 and 48 or array_ndims(p_choices) <> 1 then
    raise exception 'Invalid vote' using errcode='22023';
  end if;
  if (select count(distinct choice) from unnest(p_choices) choice) <> cardinality(p_choices)
    or exists (select 1 from unnest(p_choices) choice where choice is null
      or not exists (select 1 from public.theme_catalog t where t.id=choice)) then
    raise exception 'Invalid theme selection' using errcode='22023';
  end if;
  if (select count(distinct family) from public.theme_catalog where id=any(p_choices)) <> 4 then
    raise exception 'Choose at least one theme in every group' using errcode='22023';
  end if;
  if (p_age_group is not null and p_age_group not in ('under_18','18_24','25_34','35_44','45_54','55_64','65_plus'))
    or (p_gender is not null and p_gender not in ('woman','man','other')) then
    raise exception 'Invalid demographic value' using errcode='22023';
  end if;
  -- Serialize requests for one browser. Retries reuse the same submission ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_voter_id::text,0));
  select vote_number into response_number from public.theme_vote_submissions
    where submission_id=p_submission_id and voter_id=p_voter_id;
  if found then return response_number; end if;
  insert into public.theme_votes(voter_id,choices,age_group,gender,submission_count)
    values(p_voter_id,p_choices,p_age_group,p_gender,1)
    on conflict(voter_id) do update set
      choices=excluded.choices,age_group=excluded.age_group,gender=excluded.gender,
      updated_at=now(),submission_count=public.theme_votes.submission_count+1
    returning submission_count into response_number;
  insert into public.theme_vote_submissions(submission_id,voter_id,vote_number,choices,age_group,gender)
    values(p_submission_id,p_voter_id,response_number,p_choices,p_age_group,p_gender);
  return response_number;
end;
$$;
revoke all on function public.record_theme_vote(uuid,uuid,text[],text,text) from public, anon, authenticated;
grant execute on function public.record_theme_vote(uuid,uuid,text[],text,text) to anon;

-- Keep old cached pages functional; their submissions also append to history.
create or replace function public.submit_theme_vote(
  p_voter_id uuid,p_choices text[],p_age_group text default null,p_gender text default null
) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.record_theme_vote(p_voter_id,pg_catalog.gen_random_uuid(),p_choices,p_age_group,p_gender);
  return 'accepted';
end;
$$;
revoke all on function public.submit_theme_vote(uuid,text[],text,text) from public, anon, authenticated;
grant execute on function public.submit_theme_vote(uuid,text[],text,text) to anon;

do $$
begin
  if exists (
    select 1 from vote_history_before b left join public.theme_votes v using(voter_id)
    where v.voter_id is null or (v.created_at,v.updated_at,v.choices,v.age_group,v.gender)
      is distinct from (b.created_at,b.updated_at,b.choices,b.age_group,b.gender)
  ) or exists (
    select 1 from vote_history_before b where not exists (
      select 1 from public.theme_vote_submissions s where s.voter_id=b.voter_id
        and s.choices=b.choices and s.age_group is not distinct from b.age_group
        and s.gender is not distinct from b.gender and s.created_at=b.updated_at
    )
  ) then raise exception 'Existing response preservation check failed'; end if;
end $$;
select 'PASS: all existing responses preserved; saved answers copied to private history' as preservation,
  (select count(*) from vote_history_before) as existing_responses;
commit;

