-- Owner-only report: run in Supabase SQL Editor, not in the public browser.
-- Each respondent can choose several themes. Percentages can add up to over 100%.
with respondents as (
  select coalesce(age_group,'not_shared') age_group, coalesce(gender,'not_shared') gender,
    count(*) respondents from public.theme_votes group by 1,2
), selections as (
  select coalesce(v.age_group,'not_shared') age_group, coalesce(v.gender,'not_shared') gender,
    c.family, c.name, c.hex, count(*) votes
  from public.theme_votes v cross join lateral unnest(v.choices) choice
  join public.theme_catalog c on c.id = choice group by 1,2,3,4,5
)
select s.*, r.respondents, round(100.0*s.votes/r.respondents,1) as percent_of_respondents
from selections s join respondents r using (age_group,gender)
order by age_group,gender,family,votes desc,name;
