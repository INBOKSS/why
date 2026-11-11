# Youth portal feedback (/youth-portal/)

A one-page form where young people vote on each block of the new youth portal prototype
(https://inbox-new-portal.lovable.app/m2) and suggest what to add. Statistics: `/youth-portal/stats/`.

- `survey-core.js` holds the blocks, the texts (idea list, reason chips) and the storage layer.
  Change texts there, not in `index.html`.
- `config.js` holds the Supabase URL and publishable key (public by design).
- `supabase.sql` adds new tables (`youth_feedback`, `youth_settings`) and three functions to the
  existing Supabase project. Run it once in the SQL Editor; it is safe to run again.
  The tables have RLS on and no policies, so the browser can only call:
  `submit_youth_feedback(p)`, `youth_public()` (no free text) and `youth_admin(p_key)` (comments, needs the stats key).
- The stats key is stored only as a SHA-256 hash in `youth_settings`. To change it:
  `update public.youth_settings set value = '<sha256 hex of the new key>' where key = 'stats_key_sha256';`
- `assets/*.webp` are screenshots of the prototype at 375 px width, 2x. Retake them if the prototype changes.
