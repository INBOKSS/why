begin;
do $$
begin
  if has_table_privilege('anon','public.theme_vote_submissions','SELECT')
    or has_table_privilege('anon','public.theme_vote_submissions','INSERT')
    or has_table_privilege('anon','public.theme_vote_submissions','UPDATE')
    or has_table_privilege('anon','public.theme_vote_submissions','DELETE')
    or has_table_privilege('authenticated','public.theme_vote_submissions','SELECT') then
    raise exception 'Public history access detected';
  end if;
  if exists(select 1 from public.theme_votes v where v.submission_count < 1
    or v.submission_count <> (select count(*) from public.theme_vote_submissions s where s.voter_id=v.voter_id)) then
    raise exception 'Existing response or counter missing from history';
  end if;
end $$;
set local role anon;
do $$
declare n integer;
begin
  n:=public.record_theme_vote('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011',
    array['blue-c2dcf2','pink-e18aaa','green-6d8e49','warm-ffa071'],null,null);
  if n<>1 then raise exception 'First vote counter incorrect'; end if;
  n:=public.record_theme_vote('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000012',
    array['blue-a4c4e0','pink-d7a6cb','green-91b6a5','warm-a76543'],'25_34','woman');
  if n<>2 then raise exception 'Second vote counter incorrect'; end if;
  n:=public.record_theme_vote('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000012',
    array['blue-a4c4e0','pink-d7a6cb','green-91b6a5','warm-a76543'],'25_34','woman');
  if n<>2 then raise exception 'Retry counted twice'; end if;
  begin
    perform public.record_theme_vote('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000013',
      array['blue-c2dcf2','blue-a4c4e0','blue-cfe0f0','blue-7d95b9'],null,null);
    raise exception 'Incomplete groups accepted';
  exception when sqlstate '22023' then null;
  end;
  if public.submit_theme_vote('00000000-0000-4000-8000-000000000010',
    array['blue-c2dcf2','pink-e18aaa','green-6d8e49','warm-ffa071'],null,null)<>'accepted' then
    raise exception 'Old cached client rejected';
  end if;
end $$;
reset role;
do $$
begin
  if (select submission_count from public.theme_votes where voter_id='00000000-0000-4000-8000-000000000010')<>3
    or (select count(*) from public.theme_vote_submissions where voter_id='00000000-0000-4000-8000-000000000010')<>3
    or not exists(select 1 from public.theme_vote_submissions where voter_id='00000000-0000-4000-8000-000000000010'
      and vote_number=1 and choices=array['blue-c2dcf2','pink-e18aaa','green-6d8e49','warm-ffa071'] and age_group is null)
    or not exists(select 1 from public.theme_vote_submissions where voter_id='00000000-0000-4000-8000-000000000010'
      and vote_number=2 and choices=array['blue-a4c4e0','pink-d7a6cb','green-91b6a5','warm-a76543'] and age_group='25_34' and gender='woman') then
    raise exception 'History, numbering or separate choices incorrect';
  end if;
end $$;
rollback;
select 'PASS: existing history and counts preserved; separate votes, numbering, retry deduplication, old clients and required groups verified; test data rolled back' as verification;
