-- 0006_drill_sessions_client_id_text.sql
-- drill_sessions.client_id was declared uuid, but not every drill's local
-- session id is a uuid -- Lag Putt Test and Round Simulation key sessions
-- off Date.now() (a number), and future drills may use other client-side
-- id schemes. client_id only needs to be an opaque, unique-per-drill
-- dedup key, so widen it to text (existing uuid values round-trip losslessly).

alter table public.drill_sessions
  alter column client_id type text using client_id::text;
