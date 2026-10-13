-- Append inside the public-stats.sql transaction, replacing COMMIT.
do $$
declare a jsonb; f jsonb; empty_result jsonb; before_count bigint;
begin
  select count(*) into before_count from public.theme_vote_submissions;
  a := public.get_theme_stats();
  f := public.get_theme_stats('first');
  if (a->'totals'->>'submissions')::bigint <> before_count
    or (select (g->>'submissions')::bigint from jsonb_array_elements(a->'groups') g where g->>'kind'='summary') <> before_count
    or (select (g->>'submissions')::bigint from jsonb_array_elements(f->'groups') g where g->>'kind'='summary') <> (select count(distinct voter_id) from public.theme_vote_submissions)
    or jsonb_array_length(a->'catalog') <> 48 then
    raise exception 'Aggregate counts do not match source records';
  end if;
  if a::text ~ 'voter_id|submission_id|created_at|choices|vote_number' then
    raise exception 'Individual response fields leaked';
  end if;
  if has_table_privilege('anon','public.theme_vote_submissions','SELECT')
    or has_table_privilege('anon','public.theme_votes','SELECT') then
    raise exception 'Private tables exposed';
  end if;
  begin
    perform public.get_theme_stats('invalid');
    raise exception 'Invalid filter accepted';
  exception when sqlstate '22023' then null;
  end;
  if (select count(*) from public.theme_vote_submissions)<>before_count then
    raise exception 'Responses changed';
  end if;
end $$;
select public.get_theme_stats() as report_data;
rollback;
