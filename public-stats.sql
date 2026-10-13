-- Public aggregate-only endpoint. Individual responses stay private.
begin;
create or replace function public.get_theme_stats(
  p_method text default 'all', p_age text default 'all', p_gender text default 'all'
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if p_method is null or p_method not in ('all','first')
    or p_age is null or p_age not in ('all','not_shared','under_18','18_24','25_34','35_44','45_54','55_64','65_plus')
    or p_gender is null or p_gender not in ('all','not_shared','woman','man','other') then
    raise exception 'Invalid statistics filter' using errcode='22023';
  end if;
  with selected as (
    select s.voter_id,s.choices,coalesce(s.age_group,'not_shared') age_group,
      coalesce(s.gender,'not_shared') gender
    from public.theme_vote_submissions s
    where (p_method='all' or s.vote_number=1)
      and (p_age='all' or coalesce(s.age_group,'not_shared')=p_age)
      and (p_gender='all' or coalesce(s.gender,'not_shared')=p_gender)
  ), expanded as (
    select s.voter_id,s.choices,g.kind,g.age_group,g.gender from selected s
    cross join lateral (values
      ('summary'::text,''::text,''::text), ('age',s.age_group,''),
      ('gender','',s.gender), ('joint',s.age_group,s.gender)
    ) g(kind,age_group,gender)
  ), counts as (
    select kind,age_group,gender,count(*) submissions,count(distinct voter_id) browsers
    from expanded group by kind,age_group,gender
  ), selections as (
    select e.kind,e.age_group,e.gender,choice,count(*) votes
    from expanded e cross join lateral unnest(e.choices) choice
    group by e.kind,e.age_group,e.gender,choice
  ), grouped as (
    select c.*,coalesce((select jsonb_object_agg(s.choice,s.votes) from selections s
      where (s.kind,s.age_group,s.gender)=(c.kind,c.age_group,c.gender)),'{}'::jsonb) theme_counts
    from counts c
  )
  select jsonb_build_object(
    'generated_at',now(),
    'catalog',(select jsonb_agg(to_jsonb(c) order by c.family,c.name) from public.theme_catalog c),
    'totals',(select jsonb_build_object('submissions',count(*),'browsers',count(distinct voter_id),
      'additional_submissions',count(*)-count(distinct voter_id)) from public.theme_vote_submissions),
    'groups',coalesce((select jsonb_agg(to_jsonb(g) order by kind,age_group,gender) from grouped g),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_theme_stats(text,text,text) from public,anon,authenticated;
grant execute on function public.get_theme_stats(text,text,text) to anon;
commit;
