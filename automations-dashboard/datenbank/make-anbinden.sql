-- ============================================================================
-- Automationen aus Make.com an das Dashboard anschließen
--
-- Ohne diese Datei müsste ein Make-Szenario die Tabellen direkt beschreiben
-- und dabei Spaltennamen, Zustände und Zeitstempel selbst richtig setzen.
-- Das ist fehleranfällig und muss in jedem Szenario wiederholt werden.
--
-- Stattdessen gibt es hier zwei Aufrufe. Ein Szenario meldet am Anfang
-- "ich laufe" und am Ende "ich bin fertig, das kam dabei heraus". Mehr nicht.
--
-- Einmal im SQL-Editor von Supabase ausführen.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Eine Automation eintragen
--
-- Für jedes Make-Szenario einmal ausführen. Die Nummer des Szenarios steht in
-- Make in der Adresszeile, zum Beispiel .../scenarios/1234567 → 1234567.
--
-- Passe Name, Beschreibung, Bereich und Zeitplan an, dann ausführen. Die
-- ausgegebene id brauchst du gleich in Make.
-- ----------------------------------------------------------------------------

-- insert into automations (name, description, category, status, schedule_cron, n8n_workflow_id, n8n_instance, is_active)
-- values (
--   'Name der Automation',
--   'Was sie macht, in einem Satz auf Deutsch.',
--   'Marktplätze',
--   'stopped',
--   '*/15 * * * *',
--   '1234567',
--   'make.com',
--   true
-- )
-- returning id, name;


-- ----------------------------------------------------------------------------
-- 2. "Ich laufe jetzt"
--
-- Make ruft das als Erstes im Szenario auf. Zurück kommt die id des Durchlaufs,
-- die Make sich merken muss, um am Ende das Ergebnis nachzutragen.
-- ----------------------------------------------------------------------------

create or replace function lauf_start(
  automation uuid,
  ausgeloest_durch text default 'schedule'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  neuer_lauf uuid;
begin
  insert into automation_runs (automation_id, status, started_at, trigger_type)
  values (automation, 'running', now(), ausgeloest_durch)
  returning id into neuer_lauf;

  update automations
     set status = 'running',
         last_run_at = now()
   where id = automation;

  return neuer_lauf;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. "Ich bin fertig"
--
-- Make ruft das als Letztes auf, auch im Fehlerfall. `erfolg` entscheidet, ob
-- der Durchlauf als erfolgreich oder als fehlgeschlagen im Dashboard steht.
--
-- Bei einem Fehler wird zusätzlich ein Eintrag im Fehlerbereich angelegt,
-- damit sich jemand darum kümmern kann. Der Text in `klartext` ist der, den
-- die Kollegen zu sehen bekommen. Also bitte auf Deutsch und so, dass daraus
-- hervorgeht, was zu tun ist.
-- ----------------------------------------------------------------------------

create or replace function lauf_ende(
  lauf uuid,
  erfolg boolean,
  gesamt integer default 0,
  in_ordnung integer default 0,
  nicht_geklappt integer default 0,
  klartext text default null,
  technisch text default null,
  protokoll_adresse text default null,
  naechster_lauf timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  gehoert_zu uuid;
  ueberschrift text;
begin
  update automation_runs
     set status = case when erfolg then 'success' else 'error' end,
         finished_at = now(),
         items_total = gesamt,
         items_success = in_ordnung,
         items_failed = nicht_geklappt,
         error_message_readable = klartext,
         error_message_raw = technisch,
         raw_log_url = protokoll_adresse
   where id = lauf
   returning automation_id into gehoert_zu;

  if gehoert_zu is null then
    raise exception 'Diesen Durchlauf gibt es nicht: %', lauf;
  end if;

  update automations
     set status = case when erfolg then 'running' else 'error' end,
         last_run_at = now(),
         next_run_at = coalesce(naechster_lauf, next_run_at)
   where id = gehoert_zu;

  -- Nur bei einem echten Fehler einen Eintrag für den Fehlerbereich anlegen.
  if not erfolg then
    select name into ueberschrift from automations where id = gehoert_zu;

    insert into automation_errors (
      automation_id, run_id, severity, status, title, message_readable
    )
    values (
      gehoert_zu,
      lauf,
      case when nicht_geklappt > 0 and in_ordnung > 0 then 'mittel' else 'hoch' end,
      'open',
      coalesce(ueberschrift, 'Automation') || ' ist nicht durchgelaufen',
      coalesce(klartext, 'Der Durchlauf wurde abgebrochen. Ein Grund wurde nicht mitgeliefert.')
    );
  end if;
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Offene Steueraufträge abholen
--
-- Das Dashboard schreibt jeden Knopfdruck nach control_commands. Damit ein
-- Auftrag nicht zweimal ausgeführt wird, holt Make ihn hiermit ab: der Aufruf
-- gibt den Auftrag zurück und setzt ihn im selben Schritt auf "angenommen".
--
-- Zurück kommt nichts, wenn nichts ansteht. Dann beendet Make das Szenario.
-- ----------------------------------------------------------------------------

create or replace function auftrag_abholen(automation uuid)
returns table (auftrag_id uuid, was text, gehoert_zu_lauf uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update control_commands
     set status = 'accepted',
         processed_at = now()
   where id = (
     select id
       from control_commands
      where automation_id = automation
        and status = 'pending'
      order by requested_at
      limit 1
      for update skip locked
   )
  returning id, action::text, run_id;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. Steuerauftrag abschließen
-- ----------------------------------------------------------------------------

create or replace function auftrag_erledigt(auftrag uuid, geklappt boolean default true)
returns void
language sql
security definer
set search_path = public
as $$
  update control_commands
     set status = case when geklappt then 'done' else 'failed' end,
         processed_at = now()
   where id = auftrag;
$$;


-- ----------------------------------------------------------------------------
-- 6. Rechte
--
-- Diese Aufrufe darf nur die Maschine benutzen, nicht der Browser. Deshalb
-- bekommt ausschließlich service_role das Recht. Der Schlüssel dafür gehört
-- in die Verbindung in Make und niemals in das Dashboard.
-- ----------------------------------------------------------------------------

revoke all on function lauf_start(uuid, text) from public, anon, authenticated;
revoke all on function lauf_ende(uuid, boolean, integer, integer, integer, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function auftrag_abholen(uuid) from public, anon, authenticated;
revoke all on function auftrag_erledigt(uuid, boolean) from public, anon, authenticated;

grant execute on function lauf_start(uuid, text) to service_role;
grant execute on function lauf_ende(uuid, boolean, integer, integer, integer, text, text, text, timestamptz) to service_role;
grant execute on function auftrag_abholen(uuid) to service_role;
grant execute on function auftrag_erledigt(uuid, boolean) to service_role;
