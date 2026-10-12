begin;

create table public.theme_catalog (
  id text primary key,
  family text not null check (family in ('Blue', 'Pink', 'Green', 'Warm')),
  name text not null,
  hex text not null check (hex ~ '^[0-9A-F]{6}$')
);
create table public.theme_votes (
  voter_id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  choices text[] not null check (cardinality(choices) between 1 and 48),
  age_group text check (age_group in ('under_18','18_24','25_34','35_44','45_54','55_64','65_plus')),
  gender text check (gender in ('woman','man','other'))
);
alter table public.theme_catalog enable row level security;
alter table public.theme_votes enable row level security;
revoke all on public.theme_catalog, public.theme_votes from public, anon, authenticated;

insert into public.theme_catalog(id,family,name,hex) values
('blue-c2dcf2','Blue','Sky','C2DCF2'),
('blue-a4c4e0','Blue','Cloud','A4C4E0'),
('blue-cfe0f0','Blue','Ice','CFE0F0'),
('blue-7d95b9','Blue','Slate','7D95B9'),
('blue-b1c1d8','Blue','Haze','B1C1D8'),
('blue-e8eef3','Blue','Porcelain','E8EEF3'),
('blue-d3dfe7','Blue','Quiet Harbor','D3DFE7'),
('blue-b9cdda','Blue','Mineral','B9CDDA'),
('blue-8aafc2','Blue','Coastal','8AAFC2'),
('blue-334b60','Blue','Midnight','334B60'),
('blue-e9eff0','Blue','Arctic Fog','E9EFF0'),
('blue-28343d','Blue','Ink Studio','28343D'),
('pink-e18aaa','Pink','Rose','E18AAA'),
('pink-e4a0b7','Pink','Blush','E4A0B7'),
('pink-ecbdc4','Pink','Petal','ECBDC4'),
('pink-efcfd4','Pink','Powder','EFCFD4'),
('pink-f5dce0','Pink','Soft','F5DCE0'),
('pink-f1eaec','Pink','Pearl','F1EAEC'),
('pink-e3d3da','Pink','Dusty Mauve','E3D3DA'),
('pink-cfbac5','Pink','Heather','CFBAC5'),
('pink-b88d9e','Pink','Vintage Rose','B88D9E'),
('pink-684d60','Pink','Mulberry','684D60'),
('pink-e8e4f0','Pink','Lavender Paper','E8E4F0'),
('green-6d8e49','Green','Olive','6D8E49'),
('green-8ea872','Green','Sage','8EA872'),
('green-b4c09c','Green','Leaf','B4C09C'),
('green-d6dac4','Green','Mist','D6DAC4'),
('green-e8eeea','Green','Linen Sage','E8EEEA'),
('green-d1ded8','Green','Eucalyptus','D1DED8'),
('green-b7cbc1','Green','Sea Glass','B7CBC1'),
('green-395a50','Green','Forest','395A50'),
('green-dcece7','Green','Fresh Mint','DCECE7'),
('warm-ffa071','Warm','Apricot','FFA071'),
('warm-ffb480','Warm','Peach','FFB480'),
('warm-fec98f','Warm','Sand','FEC98F'),
('warm-fedd9e','Warm','Honey','FEDD9E'),
('warm-f8e4d2','Warm','Orange Cream','F8E4D2'),
('warm-edba94','Warm','Soft Tangerine','EDBA94'),
('warm-ce8b61','Warm','Terracotta','CE8B61'),
('warm-685548','Warm','Cocoa','685548'),
('warm-f1d3ab','Warm','Amber Linen','F1D3AB'),
('warm-403936','Warm','Espresso','403936'),
('pink-d7a6cb','Pink','Orchid','D7A6CB'),
('green-91b6a5','Green','Jade','91B6A5'),
('green-789373','Green','Moss','789373'),
('green-22483d','Green','Pine','22483D'),
('warm-d3a66b','Warm','Caramel','D3A66B'),
('warm-a76543','Warm','Copper','A76543');

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


