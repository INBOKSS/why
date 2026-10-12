begin;
alter table public.theme_votes add column if not exists updated_at timestamptz not null default now();
alter table public.theme_votes drop constraint if exists theme_votes_choices_check;
alter table public.theme_votes add constraint theme_votes_choices_check check (cardinality(choices) between 1 and 48);
insert into public.theme_catalog(id,family,name,hex) values
('pink-d7a6cb','Pink','Orchid','D7A6CB'),
('green-91b6a5','Green','Jade','91B6A5'),
('green-789373','Green','Moss','789373'),
('green-22483d','Green','Pine','22483D'),
('warm-d3a66b','Warm','Caramel','D3A66B'),
('warm-a76543','Warm','Copper','A76543')
on conflict (id) do nothing;
create or replace function public.submit_theme_vote(
  p_voter_id uuid, p_choices text[], p_age_group text default null, p_gender text default null
) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if p_voter_id is null or p_choices is null or cardinality(p_choices) not between 4 and 48
    or array_ndims(p_choices) <> 1 then
    raise exception 'Invalid vote' using errcode = '22023';
  end if;
  if (select count(distinct family) from public.theme_catalog where id = any(p_choices)) <> 4 then
    raise exception 'Choose at least one theme in every group' using errcode = '22023';
  end if;
  if (select count(distinct choice) from unnest(p_choices) choice) <> cardinality(p_choices)
    or exists (select 1 from unnest(p_choices) choice
      where choice is null or not exists (select 1 from public.theme_catalog t where t.id = choice)) then
    raise exception 'Invalid theme selection' using errcode = '22023';
  end if;
  if (p_age_group is not null and p_age_group not in ('under_18','18_24','25_34','35_44','45_54','55_64','65_plus'))
    or (p_gender is not null and p_gender not in ('woman','man','other')) then
    raise exception 'Invalid demographic value' using errcode = '22023';
  end if;
  insert into public.theme_votes(voter_id, choices, age_group, gender)
    values (p_voter_id, p_choices, p_age_group, p_gender)
    on conflict (voter_id) do update set
      choices = excluded.choices, age_group = excluded.age_group,
      gender = excluded.gender, updated_at = now();
  return 'accepted';
end;
$$;
revoke all on function public.submit_theme_vote(uuid,text[],text,text) from public, anon, authenticated;
grant execute on function public.submit_theme_vote(uuid,text[],text,text) to anon;
commit;

