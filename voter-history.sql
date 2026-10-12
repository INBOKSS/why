-- Owner-only report. Browser identifiers are not verified people or computers.
select s.voter_id, v.submission_count as browser_vote_count, s.vote_number,
  s.created_at, s.age_group, s.gender,
  array_agg(c.family || ' · ' || c.name order by c.family,c.name) as selected_themes
from public.theme_vote_submissions s join public.theme_votes v using(voter_id)
cross join lateral unnest(s.choices) choice
join public.theme_catalog c on c.id=choice
group by s.voter_id,v.submission_count,s.vote_number,s.created_at,s.age_group,s.gender
order by s.voter_id,s.vote_number;
