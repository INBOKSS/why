-- Run in the project SQL Editor. All test data is rolled back.
begin;
do $$
begin
  if has_table_privilege('anon','public.theme_votes','SELECT')
     or has_table_privilege('anon','public.theme_votes','INSERT')
     or has_table_privilege('anon','public.theme_votes','UPDATE')
     or has_table_privilege('anon','public.theme_votes','DELETE')
     or has_table_privilege('authenticated','public.theme_votes','SELECT') then
    raise exception 'Unexpected public table access';
  end if;
  if (select count(*) from public.theme_catalog) <> 42 then raise exception 'Theme count mismatch'; end if;
end $$;
set local role anon;
do $$
declare result text;
begin
  result := public.submit_theme_vote('00000000-0000-4000-8000-000000000001',array['blue-c2dcf2','blue-a4c4e0','pink-e18aaa','green-6d8e49','warm-ffa071'],null,null);
  if result <> 'accepted' then raise exception 'Vote not accepted'; end if;
  result := public.submit_theme_vote('00000000-0000-4000-8000-000000000001',array['green-6d8e49'],'25_34','woman');
  if result <> 'already_submitted' then raise exception 'Duplicate accepted'; end if;
  begin
    perform public.submit_theme_vote('00000000-0000-4000-8000-000000000002',array['invalid'],null,null);
    raise exception 'Invalid theme accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.submit_theme_vote('00000000-0000-4000-8000-000000000002',array['green-6d8e49','green-6d8e49'],null,null);
    raise exception 'Duplicate choices accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.submit_theme_vote('00000000-0000-4000-8000-000000000002',array[]::text[],null,null);
    raise exception 'Empty vote accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.submit_theme_vote('00000000-0000-4000-8000-000000000002',array['green-6d8e49'],'invalid',null);
    raise exception 'Invalid demographics accepted';
  exception when sqlstate '22023' then null;
  end;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.theme_votes where voter_id='00000000-0000-4000-8000-000000000001') <> 1
    or (select cardinality(choices) from public.theme_votes where voter_id='00000000-0000-4000-8000-000000000001') <> 5 then
    raise exception 'Vote count or original choices changed';
  end if;
end $$;
rollback;
select 'PASS: multi-select, optional demographics, duplicate handling, validation and private responses; test data rolled back' as verification;
