-- ===========================================================================
-- Rechte für das Automations-Dashboard
--
-- Führ diese Datei im SQL Editor von Supabase aus, wenn im Dashboard zwar die
-- Übersicht erscheint, die Listen aber leer bleiben. Sie ist so geschrieben,
-- dass mehrfaches Ausführen nichts kaputt macht.
--
-- Zwei Schlösser hängen an jeder Tabelle:
--   1. Das Leserecht entscheidet, ob eine Rolle die Tabelle überhaupt anfassen
--      darf. Fehlt es, lehnt die Datenbank ab, bevor eine Regel greift.
--   2. Row Level Security entscheidet, welche Zeilen sichtbar sind.
-- Beides wird hier gesetzt.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Die Rollenfunktion darf sich nicht selbst im Kreis aufrufen
--
-- Ohne security definer liest sie profiles mit den Rechten des Aufrufers,
-- dabei prüft die Datenbank wieder die Regel, die diese Funktion aufruft.
-- Postgres bricht das mit "infinite recursion detected in policy" ab.
-- ---------------------------------------------------------------------------

create or replace function public.current_role_name()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.darf_steuern()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role in ('operator', 'admin')
  );
$$;

create or replace function public.ist_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role = 'admin'
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. Leserechte für angemeldete Mitarbeiter
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on table profiles to authenticated;
grant select on table automations to authenticated;
grant select on table automation_runs to authenticated;
grant select on table automation_errors to authenticated;
grant select on table control_commands to authenticated;
grant select on table audit_log to authenticated;

grant select on v_dashboard_summary_24h to authenticated;
grant select on v_reliability_trend_14d to authenticated;
grant select on v_open_errors_ranked to authenticated;
grant select on v_automation_overview to authenticated;

-- Artikeldaten aus PlentyONE, für die Suche im Dashboard
grant select on v_artikel_komplett to authenticated;
grant select on table plenty_variationen to authenticated;
grant select on table plenty_artikeltexte to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Ansehen darf jeder Angemeldete
--
-- Das Dashboard zeigt Zuständigkeiten und wer etwas gesteuert hat. Dafür
-- müssen alle Angemeldeten die Stammdaten der Kolleginnen und Kollegen lesen
-- dürfen. Passwörter liegen nicht in dieser Tabelle.
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table automation_errors enable row level security;
alter table control_commands enable row level security;
alter table audit_log enable row level security;

drop policy if exists "profile lesen" on profiles;
create policy "profile lesen" on profiles
for select to authenticated using (true);

drop policy if exists "automationen lesen" on automations;
create policy "automationen lesen" on automations
for select to authenticated using (true);

drop policy if exists "durchlaeufe lesen" on automation_runs;
create policy "durchlaeufe lesen" on automation_runs
for select to authenticated using (true);

drop policy if exists "fehler lesen" on automation_errors;
create policy "fehler lesen" on automation_errors
for select to authenticated using (true);

drop policy if exists "auftraege lesen" on control_commands;
create policy "auftraege lesen" on control_commands
for select to authenticated using (true);

drop policy if exists "protokoll lesen" on audit_log;
create policy "protokoll lesen" on audit_log
for select to authenticated using (true);

-- Artikeldaten: nur lesen, und nur für Angemeldete. Falls auf den beiden
-- Plenty-Tabellen keine Row Level Security aktiv ist, sind die beiden
-- folgenden Blöcke wirkungslos und schaden nicht.
alter table plenty_variationen enable row level security;
alter table plenty_artikeltexte enable row level security;

drop policy if exists "artikeldaten lesen" on plenty_variationen;
create policy "artikeldaten lesen" on plenty_variationen
for select to authenticated using (true);

drop policy if exists "artikeltexte lesen" on plenty_artikeltexte;
create policy "artikeltexte lesen" on plenty_artikeltexte
for select to authenticated using (true);


-- ---------------------------------------------------------------------------
-- 4. Steuern darf, wer das Recht dazu hat
--
-- Ein Steuerknopf schreibt eine Zeile in control_commands. Fehler übernehmen
-- und abhaken ändert automation_errors. Beides nur für operator und admin.
-- ---------------------------------------------------------------------------

grant insert on table control_commands to authenticated;
grant update on table automation_errors to authenticated;

drop policy if exists "auftrag anlegen" on control_commands;
create policy "auftrag anlegen" on control_commands
for insert to authenticated
with check (public.darf_steuern() and requested_by = auth.uid());

drop policy if exists "fehler bearbeiten" on automation_errors;
create policy "fehler bearbeiten" on automation_errors
for update to authenticated
using (public.darf_steuern())
with check (public.darf_steuern());


-- ---------------------------------------------------------------------------
-- 5. Zugänge vergeben darf nur der Admin
-- ---------------------------------------------------------------------------

grant update on table profiles to authenticated;
grant insert on table audit_log to authenticated;

drop policy if exists "admin darf zugaenge aendern" on profiles;
create policy "admin darf zugaenge aendern" on profiles
for update to authenticated
using (public.ist_admin())
with check (public.ist_admin());

drop policy if exists "admin schreibt protokoll" on audit_log;
create policy "admin schreibt protokoll" on audit_log
for insert to authenticated
with check (public.ist_admin());


-- ---------------------------------------------------------------------------
-- 6. Zur Kontrolle: welche Regeln stehen jetzt wo
-- ---------------------------------------------------------------------------

select tablename, policyname, cmd, roles, qual::text as bedingung
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;
