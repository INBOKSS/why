-- Owner-only report: run in Supabase SQL Editor, not in the public browser.
-- Each submission can choose several themes. Percentages can add up to over 100%.
-- Repeated submissions count separately; browser count is also shown.
with respondents as (
  select coalesce(age_group,'not_shared') age_group, coalesce(gender,'not_shared') gender,
    count(*) submissions, count(distinct voter_id) browsers from public.theme_vote_submissions group by 1,2
), selections as (
  select coalesce(v.age_group,'not_shared') age_group, coalesce(v.gender,'not_shared') gender,
    c.family, c.name, c.hex, count(*) votes
  from public.theme_vote_submissions v cross join lateral unnest(v.choices) choice
  join public.theme_catalog c on c.id = choice group by 1,2,3,4,5
)
select s.*, r.submissions, r.browsers, round(100.0*s.votes/r.submissions,1) as percent_of_submissions
from selections s join respondents r using (age_group,gender)
order by age_group,gender,family,votes desc,name;
