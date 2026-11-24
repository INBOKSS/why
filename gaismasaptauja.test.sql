-- Tests for gaismasaptauja.sql. Paste into the Supabase SQL editor and run.
--
-- Everything runs inside one DO block that ends with an exception, so every change
-- (test rows, the temporary stats key, the dropped-and-rebuilt table of the upgrade
-- test) is rolled back automatically. Real data is never changed.
--
-- Result:  "PASS: ..."  in the error box  -> all checks passed
--          "FAIL ..."   / "assertion"     -> the message says which check failed
do $test$
declare
  va uuid := gen_random_uuid();
  vb uuid := gen_random_uuid();
  vc uuid := gen_random_uuid();
  vd uuid := gen_random_uuid();
  r text;
  j jsonb;
  n integer;
  existing integer;
  checks integer := 0;
begin
  -- ---------------------------------------------------------------- setup
  assert (select count(*) from public.gaisma_responses where name_key like 'zztest%') = 0,
    'setup: leftover ZZTEST rows exist';

  -- ------------------------------------------------- 1. create and normalise
  r := public.submit_gaisma_response(va, '  ZZTEST ' || chr(8203) || '  Alpha ', '2026-12-06');
  assert r = 'created', '1a: first save should return created, got ' || coalesce(r, 'null');
  assert (select name from public.gaisma_responses where voter_id = va) = 'ZZTEST Alpha',
    '1b: name should be trimmed, collapsed and stripped of zero-width characters';
  assert (select name_key from public.gaisma_responses where voter_id = va) = 'zztest alpha',
    '1c: name_key should be the lower-cased name';
  checks := checks + 3;

  -- ------------------------------------------------ 2. same browser may change
  r := public.submit_gaisma_response(va, 'ZZTEST Alpha', '2026-12-13');
  assert r = 'updated', '2a: second save from the same browser should return updated, got ' || coalesce(r, 'null');
  assert (select count(*) from public.gaisma_responses where voter_id = va) = 1, '2b: still one row per browser';
  assert (select date_id from public.gaisma_responses where voter_id = va) = '2026-12-13', '2c: date changed';
  checks := checks + 3;

  -- ----------------------------------------- 3. another browser cannot take a name
  begin
    perform public.submit_gaisma_response(vb, 'zztest ALPHA', '2026-12-20');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Name taken', '3a: stealing a name (any case) must fail with Name taken, got ' || sqlerrm;
  end;
  assert (select date_id from public.gaisma_responses where voter_id = va) = '2026-12-13',
    '3b: the original answer must be untouched after a steal attempt';
  checks := checks + 2;

  -- ------------------------------------------------ 4. rename frees the old name
  r := public.submit_gaisma_response(va, 'ZZTEST Beta', '2026-12-13');
  assert r = 'updated', '4a: rename returns updated';
  r := public.submit_gaisma_response(vb, 'ZZTEST Alpha', '2026-12-20');
  assert r = 'created', '4b: the freed name can be used by another browser, got ' || coalesce(r, 'null');
  begin
    perform public.submit_gaisma_response(vb, 'ZZTEST Beta', '2026-12-20');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Name taken', '4c: renaming into a taken name must fail, got ' || sqlerrm;
  end;
  checks := checks + 3;

  -- ------------------------------------------- 5. Latvian letters are case-insensitive
  r := public.submit_gaisma_response(vc, 'ZZTEST ' || chr(256) || 'bols', '2026-12-27');   -- Ābols
  assert r = 'created', '5a: Latvian name saved';
  begin
    perform public.submit_gaisma_response(vd, 'zztest ' || chr(257) || 'bols', '2026-12-27');   -- ābols
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Name taken', '5b: Ā and ā must count as the same name, got ' || sqlerrm;
  end;
  checks := checks + 2;

  -- ------------------------------------------------------------ 6. validation
  begin
    perform public.submit_gaisma_response(vd, 'ZZTEST D', '2099-01-01');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid date', '6a: bad date, got ' || sqlerrm;
  end;
  begin
    perform public.submit_gaisma_response(vd, 'ZZTEST D', null);
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid date', '6b: null date, got ' || sqlerrm;
  end;
  begin
    perform public.submit_gaisma_response(vd, '   ', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid name', '6c: blank name, got ' || sqlerrm;
  end;
  begin
    perform public.submit_gaisma_response(vd, chr(7) || chr(8203) || chr(8238), '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid name', '6d: only control/invisible characters, got ' || sqlerrm;
  end;
  begin
    perform public.submit_gaisma_response(vd, repeat('x', 61), '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid name', '6e: 61 characters, got ' || sqlerrm;
  end;
  r := public.submit_gaisma_response(vd, 'ZZTEST ' || repeat('y', 53), '2026-12-06');
  assert r = 'created', '6f: exactly 60 characters is allowed';
  begin
    perform public.submit_gaisma_response(null, 'ZZTEST N', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Invalid voter', '6g: null voter, got ' || sqlerrm;
  end;
  assert (select count(*) from public.gaisma_responses where name_key = 'zztest d' or name_key = 'zztest n') = 0,
    '6h: rejected requests must not leave rows';
  checks := checks + 8;

  -- --------------------------------------------- 7. public counts hide the names
  j := public.get_gaisma_counts();
  assert jsonb_typeof(j) = 'array', '7a: counts is an array';
  assert j::text not like '%ZZTEST%' and j::text not like '%name%', '7b: counts must not contain names';
  assert (select coalesce(sum((e->>'votes')::int), 0) from jsonb_array_elements(j) e)
         = (select count(*) from public.gaisma_responses), '7c: counts add up to all rows';
  checks := checks + 3;

  -- ------------------------------------------ 8. names need the stats key
  begin
    perform public.get_gaisma_results('definitely-wrong');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Forbidden' and sqlstate = '42501', '8a: wrong key, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.get_gaisma_results(null);
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Forbidden', '8b: null key, got ' || sqlerrm;
  end;
  begin
    perform public.get_gaisma_results('');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Forbidden', '8c: empty key, got ' || sqlerrm;
  end;
  assert (select length(value) from public.gaisma_settings where key = 'stats_key_sha256') = 64,
    '8d: a 64-character SHA-256 hash is stored';
  -- Temporary key for the test only; rolled back with everything else.
  update public.gaisma_settings
    set value = encode(sha256(convert_to('zz-test-key', 'utf8')), 'hex') where key = 'stats_key_sha256';
  j := public.get_gaisma_results('zz-test-key');
  assert jsonb_typeof(j) = 'array', '8e: correct key returns an array';
  assert exists (select 1 from jsonb_array_elements(j) e where e->>'name' = 'ZZTEST Beta' and e->>'date_id' = '2026-12-13'),
    '8f: the renamed answer is listed';
  assert not exists (select 1 from jsonb_array_elements(j) e where (select array_agg(k order by k) from jsonb_object_keys(e) k) <> array['date_id','name']),
    '8g: only name and date_id are returned';
  assert j::text not like '%' || va::text || '%', '8h: voter_id must never be returned';
  checks := checks + 7;

  -- --------------------------------------- 9. the anon role (what the website uses)
  set local role anon;
  begin
    perform count(*) from public.gaisma_responses;
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '42501', '9a: anon must not read the table, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform count(*) from public.gaisma_settings;
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '42501', '9b: anon must not read settings (key hash), got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.gaisma_responses(voter_id, name, name_key, date_id) values (gen_random_uuid(), 'ZZTEST X', 'zztest x', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '42501', '9c: anon must not insert directly, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    delete from public.gaisma_responses;
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '42501', '9d: anon must not delete, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    update public.gaisma_responses set date_id = '2026-12-06';
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '42501', '9e: anon must not update, got ' || sqlstate || ' ' || sqlerrm;
  end;
  r := public.submit_gaisma_response(gen_random_uuid(), 'ZZTEST Anon', '2026-12-06');
  assert r = 'created', '9f: anon can call submit_gaisma_response';
  assert jsonb_typeof(public.get_gaisma_counts()) = 'array', '9g: anon can call get_gaisma_counts';
  assert jsonb_typeof(public.get_gaisma_results('zz-test-key')) = 'array', '9h: anon can call get_gaisma_results';
  reset role;
  checks := checks + 8;

  -- ---------------------------------------------------- 10. table constraints
  begin
    insert into public.gaisma_responses(voter_id, name, name_key, date_id) values (gen_random_uuid(), 'ZZTEST bad', 'zztest bad', '2026-11-01');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '23514', '10a: check constraint on date_id, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.gaisma_responses(voter_id, name, name_key, date_id) values (gen_random_uuid(), 'dup', 'zztest beta', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '23505', '10b: unique name_key, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.gaisma_responses(voter_id, name, name_key, date_id) values (va, 'dup2', 'zztest dup2', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlstate = '23505', '10c: unique voter_id, got ' || sqlstate || ' ' || sqlerrm;
  end;
  assert (select relrowsecurity from pg_class where oid = 'public.gaisma_responses'::regclass), '10d: RLS on responses';
  assert (select relrowsecurity from pg_class where oid = 'public.gaisma_settings'::regclass), '10e: RLS on settings';
  checks := checks + 5;

  -- ------------------------------------------------------------- 11. rate limit
  insert into public.gaisma_responses(voter_id, name, name_key, date_id, updated_at)
    select gen_random_uuid(), 'ZZTESTFILL' || g, 'zztestfill' || g, '2026-12-06', now() from generate_series(1, 30) g;
  begin
    perform public.submit_gaisma_response(gen_random_uuid(), 'ZZTEST Late', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Too many requests' and sqlstate = '54000', '11a: rate limit, got ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.submit_gaisma_response(va, 'ZZTEST Beta', '2026-12-20');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Too many requests', '11b: the limit also applies to changes, got ' || sqlerrm;
  end;
  delete from public.gaisma_responses where name_key like 'zztestfill%';
  checks := checks + 2;

  -- ----------------------------------------------------------------- 12. cap
  select count(*) into existing from public.gaisma_responses;
  insert into public.gaisma_responses(voter_id, name, name_key, date_id, updated_at)
    select gen_random_uuid(), 'ZZTESTCAP' || g, 'zztestcap' || g, '2026-12-06', now() - interval '1 hour'
    from generate_series(1, 1000 - existing) g;
  begin
    perform public.submit_gaisma_response(gen_random_uuid(), 'ZZTEST Over', '2026-12-06');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Poll is full' and sqlstate = '54000', '12a: cap of 1000, got ' || sqlstate || ' ' || sqlerrm;
  end;
  r := public.submit_gaisma_response(va, 'ZZTEST Beta', '2026-12-20');
  assert r = 'updated', '12b: someone who already answered can still change it when the poll is full';
  delete from public.gaisma_responses where name_key like 'zztestcap%';
  checks := checks + 2;

  -- ----------------------------- 13. upgrade from the first version (no voter_id)
  drop table public.gaisma_responses cascade;
  create table public.gaisma_responses (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 60),
    name_key text not null unique,
    date_id text not null check (date_id in ('2026-12-06','2026-12-13','2026-12-20','2026-12-27')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  insert into public.gaisma_responses(name, name_key, date_id) values
    ('Old One', 'old one', '2026-12-06'), ('Old Two', 'old two', '2026-12-13');
  -- the upgrade statements, exactly as in gaismasaptauja.sql
  alter table public.gaisma_responses add column if not exists voter_id uuid;
  update public.gaisma_responses set voter_id = gen_random_uuid() where voter_id is null;
  alter table public.gaisma_responses alter column voter_id set not null;
  create unique index if not exists gaisma_responses_voter_id_key on public.gaisma_responses(voter_id);
  alter table public.gaisma_responses enable row level security;
  revoke all on public.gaisma_responses from public, anon, authenticated;
  assert (select count(distinct voter_id) from public.gaisma_responses) = 2, '13a: old rows get their own voter_id';
  r := public.submit_gaisma_response(gen_random_uuid(), 'New Three', '2026-12-20');
  assert r = 'created', '13b: new answers work on the upgraded table';
  begin
    perform public.submit_gaisma_response(gen_random_uuid(), 'old ONE', '2026-12-20');
    raise exception 'EXPECTED_ERROR_NOT_RAISED';
  exception when others then
    assert sqlerrm = 'Name taken', '13c: names from before the upgrade stay protected, got ' || sqlerrm;
  end;
  checks := checks + 3;

  -- Always end with an exception so that everything above is rolled back.
  raise exception 'PASS: all % checks passed (all changes rolled back)', checks;
end
$test$;
