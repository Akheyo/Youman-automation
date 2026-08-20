-- ============================================================================
--  Komplett Konzept — Automations-Dashboard
--  Datenbank-Schema (Supabase / Postgres)
--
--  Einmalig ausfuehren: Supabase-Dashboard -> SQL Editor -> New query ->
--  Inhalt einfuegen -> Run. Das Skript ist idempotent, es darf beliebig oft
--  erneut ausgefuehrt werden (z. B. nach einem Update).
--
--  Alle Tabellen tragen das Praefix "kk_", damit sie sich sauber von anderen
--  Projekten im selben Supabase-Projekt trennen. Bezeichner sind bewusst ohne
--  Umlaute geschrieben (ae/oe/ue), alle sichtbaren Texte dagegen in korrektem
--  Deutsch mit Umlauten.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
--  1. MITARBEITER UND RECHTE
-- ============================================================================
-- Drei Stufen:
--   betrachter — darf alles sehen, nichts steuern (die Mehrheit)
--   steuerer   — darf zusaetzlich starten, pausieren, wiederholen, abbrechen
--   inhaber    — darf zusaetzlich Zugaenge vergeben und entziehen
--
-- Ein Mitglied kann angelegt werden, BEVOR die Person sich das erste Mal
-- anmeldet: es zaehlt die E-Mail-Adresse. Sobald jemand mit dieser Adresse
-- einen Supabase-Account bekommt, wird benutzer_id automatisch verknuepft.
-- ---------------------------------------------------------------------------
create table if not exists public.kk_mitglieder (
  id           uuid primary key default gen_random_uuid(),
  benutzer_id  uuid unique references auth.users (id) on delete set null,
  email        text not null unique,
  name         text,
  rolle        text not null default 'betrachter'
               check (rolle in ('betrachter', 'steuerer', 'inhaber')),
  aktiv        boolean not null default true,
  telefon      text,
  notiz        text,
  letzter_zugriff timestamptz,
  angelegt_am  timestamptz not null default now(),
  angelegt_von uuid references public.kk_mitglieder (id) on delete set null
);

create index if not exists kk_mitglieder_email_idx on public.kk_mitglieder (lower(email));

-- E-Mail immer klein und ohne Leerzeichen speichern, damit die Verknuepfung
-- mit dem Login zuverlaessig greift.
create or replace function public.kk_email_normalisieren()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists kk_mitglieder_email_norm on public.kk_mitglieder;
create trigger kk_mitglieder_email_norm
  before insert or update of email on public.kk_mitglieder
  for each row execute function public.kk_email_normalisieren();

-- Neuer Supabase-Account -> vorhandene Einladung verknuepfen.
create or replace function public.kk_neuen_benutzer_verknuepfen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.kk_mitglieder
     set benutzer_id = new.id,
         name = coalesce(name, new.raw_user_meta_data ->> 'full_name')
   where benutzer_id is null
     and lower(email) = lower(new.email);
  return new;
end;
$$;

-- Eigener Trigger-Name: der Trigger des anderen Projekts bleibt unangetastet.
drop trigger if exists on_auth_user_created_kk on auth.users;
create trigger on_auth_user_created_kk
  after insert on auth.users
  for each row execute function public.kk_neuen_benutzer_verknuepfen();

-- ---------------------------------------------------------------------------
-- Rechte-Helfer. SECURITY DEFINER, damit die RLS-Regeln auf kk_mitglieder
-- sich nicht selbst aufrufen (Endlosschleife).
-- ---------------------------------------------------------------------------
create or replace function public.kk_rolle()
returns text
language sql stable security definer set search_path = public
as $$
  select m.rolle
    from public.kk_mitglieder m
   where m.benutzer_id = auth.uid()
     and m.aktiv
   limit 1
$$;

create or replace function public.kk_mitglied_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select m.id
    from public.kk_mitglieder m
   where m.benutzer_id = auth.uid()
     and m.aktiv
   limit 1
$$;

create or replace function public.kk_darf_sehen()
returns boolean
language sql stable
as $$ select public.kk_rolle() is not null $$;

create or replace function public.kk_darf_steuern()
returns boolean
language sql stable
as $$ select public.kk_rolle() in ('steuerer', 'inhaber') $$;

create or replace function public.kk_ist_inhaber()
returns boolean
language sql stable
as $$ select public.kk_rolle() = 'inhaber' $$;

-- ============================================================================
--  2. ANGEBUNDENE SYSTEME (Plenty, Maschinensucher, Mail, ...)
-- ============================================================================
create table if not exists public.kk_systeme (
  id             uuid primary key default gen_random_uuid(),
  schluessel     text not null unique,          -- z. B. 'plenty'
  name           text not null,                 -- z. B. 'PlentyONE'
  art            text,                          -- 'erp' | 'marktplatz' | 'mail' | ...
  basis_url      text,
  status         text not null default 'unbekannt'
                 check (status in ('unbekannt', 'verbunden', 'gestoert')),
  letzter_check  timestamptz,
  letzte_meldung text,
  konfiguration  jsonb not null default '{}'::jsonb,   -- niemals Passwoerter!
  angelegt_am    timestamptz not null default now()
);

comment on column public.kk_systeme.konfiguration is
  'Nur unkritische Einstellungen. Zugangsdaten gehoeren in die Umgebungsvariablen des Servers, nicht in die Datenbank.';

-- ============================================================================
--  3. AUTOMATIONEN
-- ============================================================================
create table if not exists public.kk_automationen (
  id                uuid primary key default gen_random_uuid(),
  schluessel        text not null unique,        -- technischer Name, z. B. 'plenty-bestandsabgleich'
  name              text not null,               -- Anzeigename
  beschreibung      text,                        -- ein Satz: was macht sie?
  kategorie         text,                        -- z. B. 'Bestand', 'Anfragen', 'Buchhaltung'
  system_id         uuid references public.kk_systeme (id) on delete set null,
  status            text not null default 'entwurf'
                    check (status in ('aktiv', 'pausiert', 'fehler', 'entwurf')),
  pausiert_am       timestamptz,
  pausiert_von      uuid references public.kk_mitglieder (id) on delete set null,
  pausiert_grund    text,
  zeitplan_cron     text,                        -- '*/15 * * * *'
  zeitplan_text     text,                        -- 'alle 15 Minuten'
  zeitzone          text not null default 'Europe/Berlin',
  naechster_lauf    timestamptz,
  erwartete_dauer_ms integer,                    -- fuer "dauert ungewoehnlich lange"
  verantwortlich_id uuid references public.kk_mitglieder (id) on delete set null,
  sortierung        integer not null default 100,
  angelegt_am       timestamptz not null default now(),
  aktualisiert_am   timestamptz not null default now()
);

create index if not exists kk_automationen_status_idx on public.kk_automationen (status, sortierung);

create or replace function public.kk_stempel_aktualisiert()
returns trigger
language plpgsql
as $$
begin
  new.aktualisiert_am := now();
  return new;
end;
$$;

drop trigger if exists kk_automationen_stempel on public.kk_automationen;
create trigger kk_automationen_stempel
  before update on public.kk_automationen
  for each row execute function public.kk_stempel_aktualisiert();

-- ============================================================================
--  4. DURCHLAEUFE
-- ============================================================================
create table if not exists public.kk_laeufe (
  id                 uuid primary key default gen_random_uuid(),
  automation_id      uuid not null references public.kk_automationen (id) on delete cascade,
  status             text not null default 'laeuft'
                     check (status in ('laeuft', 'erfolg', 'warnung', 'fehler', 'abgebrochen')),
  ausloeser          text not null default 'zeitplan'
                     check (ausloeser in ('zeitplan', 'manuell', 'webhook', 'wiederholung', 'test')),
  ausgeloest_von     uuid references public.kk_mitglieder (id) on delete set null,
  wiederholung_von   uuid references public.kk_laeufe (id) on delete set null,
  gestartet_am       timestamptz not null default now(),
  beendet_am         timestamptz,
  dauer_ms           integer generated always as (
                       case
                         when beendet_am is null then null
                         else (extract(epoch from (beendet_am - gestartet_am)) * 1000)::integer
                       end
                     ) stored,
  verarbeitet        integer not null default 0,
  erfolgreich        integer not null default 0,
  fehlgeschlagen     integer not null default 0,
  uebersprungen      integer not null default 0,
  zusammenfassung    text,                       -- ein Satz in verstaendlichem Deutsch
  kennzahlen         jsonb not null default '{}'::jsonb,
  abbruch_angefordert boolean not null default false
);

create index if not exists kk_laeufe_automation_idx on public.kk_laeufe (automation_id, gestartet_am desc);
create index if not exists kk_laeufe_zeit_idx       on public.kk_laeufe (gestartet_am desc);
create index if not exists kk_laeufe_laufend_idx    on public.kk_laeufe (status) where status = 'laeuft';

-- Einzelne Schritte innerhalb eines Durchlaufs — damit nachvollziehbar ist,
-- WAS passiert ist und nicht nur, DASS etwas passiert ist.
create table if not exists public.kk_lauf_schritte (
  id           uuid primary key default gen_random_uuid(),
  lauf_id      uuid not null references public.kk_laeufe (id) on delete cascade,
  position     integer not null default 1,
  name         text not null,
  status       text not null default 'laeuft'
               check (status in ('laeuft', 'erfolg', 'warnung', 'fehler', 'uebersprungen')),
  gestartet_am timestamptz not null default now(),
  beendet_am   timestamptz,
  meldung      text,
  details      jsonb not null default '{}'::jsonb
);

create index if not exists kk_lauf_schritte_lauf_idx on public.kk_lauf_schritte (lauf_id, position);

-- Nach jedem Lauf den Status der Automation nachziehen, damit die Kachel im
-- Dashboard ohne Zusatzabfrage stimmt.
create or replace function public.kk_automation_status_nachziehen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'fehler' then
    update public.kk_automationen
       set status = 'fehler'
     where id = new.automation_id
       and status = 'aktiv';
  elsif new.status = 'erfolg' then
    update public.kk_automationen
       set status = 'aktiv'
     where id = new.automation_id
       and status = 'fehler'
       and not exists (
         select 1 from public.kk_fehler f
          where f.automation_id = new.automation_id
            and f.status <> 'erledigt'
       );
  end if;
  return new;
end;
$$;

-- ============================================================================
--  5. FEHLER
-- ============================================================================
-- Gleichartige Fehler werden ueber den Fingerabdruck zusammengefasst und
-- gezaehlt, statt die Liste mit hundert identischen Meldungen zu fluten.
create table if not exists public.kk_fehler (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references public.kk_automationen (id) on delete cascade,
  lauf_id        uuid references public.kk_laeufe (id) on delete set null,
  schweregrad    text not null default 'mittel'
                 check (schweregrad in ('kritisch', 'hoch', 'mittel', 'niedrig')),
  titel          text not null,                  -- kurze Ueberschrift
  klartext       text not null,                  -- was ist passiert, in verstaendlichem Deutsch
  empfehlung     text,                           -- was jetzt zu tun ist
  technisch      text,                           -- die rohe Meldung, aufklappbar
  fingerabdruck  text not null,
  anzahl         integer not null default 1,
  status         text not null default 'offen'
                 check (status in ('offen', 'in_arbeit', 'erledigt')),
  zustaendig_id  uuid references public.kk_mitglieder (id) on delete set null,
  zuerst_am      timestamptz not null default now(),
  zuletzt_am     timestamptz not null default now(),
  uebernommen_am timestamptz,
  erledigt_am    timestamptz,
  erledigt_von   uuid references public.kk_mitglieder (id) on delete set null,
  loesung        text
);

create index if not exists kk_fehler_offen_idx
  on public.kk_fehler (status, schweregrad, zuletzt_am desc);
create index if not exists kk_fehler_automation_idx
  on public.kk_fehler (automation_id, status);

-- Ein offener Fehler je Automation und Fingerabdruck; erledigte Faelle
-- blockieren einen erneuten Eintrag nicht.
create unique index if not exists kk_fehler_offen_eindeutig
  on public.kk_fehler (automation_id, fingerabdruck)
  where status <> 'erledigt';

-- ---------------------------------------------------------------------------
-- Fehler melden: legt neu an oder zaehlt den bestehenden offenen Fall hoch.
-- Wird vom Server (Service-Role) aufgerufen.
-- ---------------------------------------------------------------------------
create or replace function public.kk_fehler_melden(
  p_automation_id uuid,
  p_lauf_id       uuid,
  p_titel         text,
  p_klartext      text,
  p_fingerabdruck text,
  p_schweregrad   text default 'mittel',
  p_empfehlung    text default null,
  p_technisch     text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.kk_fehler (
    automation_id, lauf_id, titel, klartext, fingerabdruck,
    schweregrad, empfehlung, technisch
  )
  values (
    p_automation_id, p_lauf_id, p_titel, p_klartext, p_fingerabdruck,
    coalesce(p_schweregrad, 'mittel'), p_empfehlung, p_technisch
  )
  on conflict (automation_id, fingerabdruck) where status <> 'erledigt'
  do update set
    anzahl     = public.kk_fehler.anzahl + 1,
    zuletzt_am = now(),
    lauf_id    = excluded.lauf_id,
    technisch  = coalesce(excluded.technisch, public.kk_fehler.technisch),
    klartext   = excluded.klartext
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
--  6. STEUERUNG (die Knoepfe)
-- ============================================================================
-- Ein Klick im Dashboard schreibt hier eine Zeile. Das Dashboard funktioniert
-- damit schon vollstaendig; die eigentliche Automation muss den Befehl spaeter
-- nur noch abholen und quittieren.
create table if not exists public.kk_befehle (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.kk_automationen (id) on delete cascade,
  lauf_id         uuid references public.kk_laeufe (id) on delete set null,
  befehl          text not null
                  check (befehl in ('pausieren', 'fortsetzen', 'sofort_starten', 'wiederholen', 'abbrechen')),
  status          text not null default 'offen'
                  check (status in ('offen', 'uebernommen', 'erledigt', 'fehlgeschlagen')),
  angefordert_von uuid references public.kk_mitglieder (id) on delete set null,
  angefordert_am  timestamptz not null default now(),
  uebernommen_am  timestamptz,
  erledigt_am     timestamptz,
  meldung         text,
  nutzlast        jsonb not null default '{}'::jsonb
);

create index if not exists kk_befehle_offen_idx
  on public.kk_befehle (status, angefordert_am) where status = 'offen';
create index if not exists kk_befehle_automation_idx
  on public.kk_befehle (automation_id, angefordert_am desc);

-- ============================================================================
--  7. PROTOKOLL — wer hat was gesteuert
-- ============================================================================
-- Nicht zur Kontrolle von Personen, sondern damit man spaeter sagen kann,
-- woran es lag. E-Mail wird mitgeschrieben, damit der Eintrag lesbar bleibt,
-- auch wenn ein Zugang spaeter entzogen wird.
create table if not exists public.kk_aktionen (
  id             uuid primary key default gen_random_uuid(),
  mitglied_id    uuid references public.kk_mitglieder (id) on delete set null,
  mitglied_email text,
  mitglied_name  text,
  aktion         text not null,
  objekt_typ     text,                            -- 'automation' | 'lauf' | 'fehler' | 'mitglied'
  objekt_id      uuid,
  automation_id  uuid references public.kk_automationen (id) on delete set null,
  beschreibung   text not null,                   -- ein Satz in verstaendlichem Deutsch
  details        jsonb not null default '{}'::jsonb,
  erstellt_am    timestamptz not null default now()
);

create index if not exists kk_aktionen_zeit_idx on public.kk_aktionen (erstellt_am desc);
create index if not exists kk_aktionen_automation_idx on public.kk_aktionen (automation_id, erstellt_am desc);

-- ============================================================================
--  8. PLENTY — gespiegelter Artikelbestand
-- ============================================================================
-- Die erste echte Anbindung: die Automation 'plenty-bestandsabgleich' holt
-- Artikel und Varianten aus der PlentyONE-REST-API und legt sie hier ab.
create table if not exists public.kk_plenty_artikel (
  id              bigint primary key,             -- Plenty-Artikel-ID
  varianten_id    bigint,
  nummer          text,                           -- Artikelnummer / externe Nummer
  name            text,
  hersteller      text,
  ean             text,
  bestand         numeric,
  preis           numeric,
  waehrung        text not null default 'EUR',
  aktiv           boolean,
  bild_url        text,
  plenty_url      text,
  roh             jsonb not null default '{}'::jsonb,
  zuerst_gesehen  timestamptz not null default now(),
  zuletzt_gesehen timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);

create index if not exists kk_plenty_artikel_nummer_idx on public.kk_plenty_artikel (nummer);
create index if not exists kk_plenty_artikel_gesehen_idx on public.kk_plenty_artikel (zuletzt_gesehen desc);

-- Merkt sich, wie weit der letzte Abgleich gekommen ist (Seite / Zeitstempel),
-- damit ein abgebrochener Lauf dort weitermacht, wo er aufgehoert hat.
create table if not exists public.kk_plenty_abgleich (
  schluessel        text primary key,             -- 'artikel'
  letzte_seite      integer not null default 0,
  letzter_lauf_id   uuid references public.kk_laeufe (id) on delete set null,
  letzter_erfolg_am timestamptz,
  vollstaendig_bis  timestamptz,
  stand             jsonb not null default '{}'::jsonb,
  aktualisiert_am   timestamptz not null default now()
);

-- ============================================================================
--  9. AUSWERTUNGEN FUERS DASHBOARD
-- ============================================================================
-- security_invoker: die Sichten respektieren die RLS-Regeln des Aufrufers.

-- 9a. Die Kopfzeile: ist alles in Ordnung?
create or replace view public.kk_v_uebersicht
with (security_invoker = true) as
select
  (select count(*) from public.kk_automationen)                                    as automationen_gesamt,
  (select count(*) from public.kk_automationen where status = 'aktiv')             as automationen_aktiv,
  (select count(*) from public.kk_automationen where status = 'pausiert')          as automationen_pausiert,
  (select count(*) from public.kk_automationen where status = 'fehler')            as automationen_gestoert,
  (select count(*) from public.kk_laeufe where status = 'laeuft')                  as laeuft_gerade,
  (select count(*) from public.kk_laeufe
     where gestartet_am >= now() - interval '24 hours')                            as laeufe_24h,
  (select count(*) from public.kk_laeufe
     where gestartet_am >= now() - interval '24 hours' and status = 'erfolg')      as erfolge_24h,
  (select count(*) from public.kk_laeufe
     where gestartet_am >= now() - interval '24 hours' and status = 'fehler')      as fehlschlaege_24h,
  (select coalesce(sum(verarbeitet), 0) from public.kk_laeufe
     where gestartet_am >= now() - interval '24 hours')                            as verarbeitet_24h,
  (select count(*) from public.kk_fehler where status = 'offen')                   as fehler_offen,
  (select count(*) from public.kk_fehler where status = 'in_arbeit')               as fehler_in_arbeit,
  (select count(*) from public.kk_fehler
     where status <> 'erledigt' and schweregrad in ('kritisch', 'hoch'))           as fehler_dringend;

-- 9b. Je Automation: zuletzt, naechster Termin, Zuverlaessigkeit, Zustaendige.
create or replace view public.kk_v_automationen
with (security_invoker = true) as
with letzter as (
  select distinct on (automation_id)
         automation_id, id as lauf_id, status, gestartet_am, beendet_am, dauer_ms, zusammenfassung
    from public.kk_laeufe
   order by automation_id, gestartet_am desc
),
quote as (
  select automation_id,
         count(*)                                             as laeufe_14t,
         count(*) filter (where status = 'erfolg')            as erfolge_14t,
         count(*) filter (where status = 'fehler')            as fehlschlaege_14t,
         round(avg(dauer_ms))                                 as dauer_schnitt_ms
    from public.kk_laeufe
   where gestartet_am >= now() - interval '14 days'
     and status <> 'laeuft'
   group by automation_id
),
quote_vorwoche as (
  select automation_id,
         count(*)                                             as laeufe,
         count(*) filter (where status = 'erfolg')            as erfolge
    from public.kk_laeufe
   where gestartet_am >= now() - interval '14 days'
     and gestartet_am <  now() - interval '7 days'
     and status <> 'laeuft'
   group by automation_id
),
quote_woche as (
  select automation_id,
         count(*)                                             as laeufe,
         count(*) filter (where status = 'erfolg')            as erfolge
    from public.kk_laeufe
   where gestartet_am >= now() - interval '7 days'
     and status <> 'laeuft'
   group by automation_id
),
fehler as (
  select automation_id,
         count(*) filter (where status = 'offen')             as fehler_offen,
         count(*) filter (where status = 'in_arbeit')         as fehler_in_arbeit
    from public.kk_fehler
   where status <> 'erledigt'
   group by automation_id
)
select
  a.id,
  a.schluessel,
  a.name,
  a.beschreibung,
  a.kategorie,
  a.status,
  a.zeitplan_text,
  a.zeitplan_cron,
  a.naechster_lauf,
  a.pausiert_grund,
  s.name                                       as system_name,
  s.status                                     as system_status,
  m.name                                       as verantwortlich_name,
  m.email                                      as verantwortlich_email,
  l.lauf_id                                    as letzter_lauf_id,
  l.status                                     as letzter_status,
  l.gestartet_am                               as letzter_lauf_am,
  l.dauer_ms                                   as letzte_dauer_ms,
  l.zusammenfassung                            as letzte_zusammenfassung,
  coalesce(q.laeufe_14t, 0)                    as laeufe_14t,
  coalesce(q.erfolge_14t, 0)                   as erfolge_14t,
  coalesce(q.fehlschlaege_14t, 0)              as fehlschlaege_14t,
  q.dauer_schnitt_ms,
  case when coalesce(q.laeufe_14t, 0) = 0 then null
       else round(q.erfolge_14t * 100.0 / q.laeufe_14t, 1) end   as zuverlaessigkeit_14t,
  case when coalesce(qw.laeufe, 0) = 0 or coalesce(qv.laeufe, 0) = 0 then null
       else round(qw.erfolge * 100.0 / qw.laeufe, 1)
            - round(qv.erfolge * 100.0 / qv.laeufe, 1) end       as trend_punkte,
  coalesce(f.fehler_offen, 0)                  as fehler_offen,
  coalesce(f.fehler_in_arbeit, 0)              as fehler_in_arbeit,
  exists (select 1 from public.kk_laeufe lr
           where lr.automation_id = a.id and lr.status = 'laeuft') as laeuft_gerade,
  a.sortierung
from public.kk_automationen a
left join public.kk_systeme     s  on s.id = a.system_id
left join public.kk_mitglieder  m  on m.id = a.verantwortlich_id
left join letzter               l  on l.automation_id = a.id
left join quote                 q  on q.automation_id = a.id
left join quote_woche           qw on qw.automation_id = a.id
left join quote_vorwoche        qv on qv.automation_id = a.id
left join fehler                f  on f.automation_id = a.id;

-- 9c. Verlauf der letzten 14 Tage — wurde es besser oder schlechter?
create or replace view public.kk_v_trend_14t
with (security_invoker = true) as
with tage as (
  select generate_series(
           (now() at time zone 'Europe/Berlin')::date - 13,
           (now() at time zone 'Europe/Berlin')::date,
           interval '1 day'
         )::date as tag
)
select
  t.tag,
  count(l.id)                                          as laeufe,
  count(l.id) filter (where l.status = 'erfolg')       as erfolge,
  count(l.id) filter (where l.status = 'fehler')       as fehlschlaege,
  coalesce(sum(l.verarbeitet), 0)                      as verarbeitet,
  case when count(l.id) filter (where l.status <> 'laeuft') = 0 then null
       else round(
         count(l.id) filter (where l.status = 'erfolg') * 100.0
         / count(l.id) filter (where l.status <> 'laeuft'), 1) end as erfolgsquote
from tage t
left join public.kk_laeufe l
       on ((l.gestartet_am at time zone 'Europe/Berlin')::date = t.tag)
group by t.tag
order by t.tag;

-- 9d. Offene Fehler, die schlimmsten zuerst.
create or replace view public.kk_v_fehler_offen
with (security_invoker = true) as
select
  f.id,
  f.automation_id,
  a.name                       as automation_name,
  a.schluessel                 as automation_schluessel,
  f.lauf_id,
  f.schweregrad,
  case f.schweregrad when 'kritisch' then 1 when 'hoch' then 2
                     when 'mittel'   then 3 else 4 end as rang,
  f.titel,
  f.klartext,
  f.empfehlung,
  f.technisch,
  f.anzahl,
  f.status,
  f.zustaendig_id,
  z.name                       as zustaendig_name,
  f.zuerst_am,
  f.zuletzt_am,
  f.uebernommen_am
from public.kk_fehler f
join public.kk_automationen a on a.id = f.automation_id
left join public.kk_mitglieder z on z.id = f.zustaendig_id
where f.status <> 'erledigt'
order by rang, f.zuletzt_am desc;

-- ============================================================================
--  10. ROW LEVEL SECURITY
-- ============================================================================
-- Grundregel: sehen darf jedes aktive Mitglied. Aendern darf nur, wer steuern
-- darf. Zugaenge vergibt ausschliesslich der Inhaber. Der Service-Role-Key des
-- Servers umgeht RLS und schreibt Laeufe, Schritte und Fehler.

alter table public.kk_mitglieder      enable row level security;
alter table public.kk_systeme         enable row level security;
alter table public.kk_automationen    enable row level security;
alter table public.kk_laeufe          enable row level security;
alter table public.kk_lauf_schritte   enable row level security;
alter table public.kk_fehler          enable row level security;
alter table public.kk_befehle         enable row level security;
alter table public.kk_aktionen        enable row level security;
alter table public.kk_plenty_artikel  enable row level security;
alter table public.kk_plenty_abgleich enable row level security;

-- Mitglieder --------------------------------------------------------------
drop policy if exists "kk mitglieder lesen"    on public.kk_mitglieder;
drop policy if exists "kk mitglieder anlegen"  on public.kk_mitglieder;
drop policy if exists "kk mitglieder aendern"  on public.kk_mitglieder;
drop policy if exists "kk mitglieder loeschen" on public.kk_mitglieder;

create policy "kk mitglieder lesen" on public.kk_mitglieder
  for select using (public.kk_darf_sehen() or benutzer_id = auth.uid());
create policy "kk mitglieder anlegen" on public.kk_mitglieder
  for insert with check (public.kk_ist_inhaber());
create policy "kk mitglieder aendern" on public.kk_mitglieder
  for update using (public.kk_ist_inhaber()) with check (public.kk_ist_inhaber());
create policy "kk mitglieder loeschen" on public.kk_mitglieder
  for delete using (public.kk_ist_inhaber());

-- Systeme -----------------------------------------------------------------
drop policy if exists "kk systeme lesen"   on public.kk_systeme;
drop policy if exists "kk systeme pflegen" on public.kk_systeme;
create policy "kk systeme lesen" on public.kk_systeme
  for select using (public.kk_darf_sehen());
create policy "kk systeme pflegen" on public.kk_systeme
  for all using (public.kk_ist_inhaber()) with check (public.kk_ist_inhaber());

-- Automationen ------------------------------------------------------------
drop policy if exists "kk automationen lesen"   on public.kk_automationen;
drop policy if exists "kk automationen steuern" on public.kk_automationen;
drop policy if exists "kk automationen pflegen" on public.kk_automationen;
create policy "kk automationen lesen" on public.kk_automationen
  for select using (public.kk_darf_sehen());
create policy "kk automationen steuern" on public.kk_automationen
  for update using (public.kk_darf_steuern()) with check (public.kk_darf_steuern());
create policy "kk automationen pflegen" on public.kk_automationen
  for insert with check (public.kk_ist_inhaber());

-- Laeufe und Schritte: lesen ja, schreiben macht der Server ----------------
drop policy if exists "kk laeufe lesen"    on public.kk_laeufe;
drop policy if exists "kk schritte lesen"  on public.kk_lauf_schritte;
create policy "kk laeufe lesen" on public.kk_laeufe
  for select using (public.kk_darf_sehen());
create policy "kk schritte lesen" on public.kk_lauf_schritte
  for select using (public.kk_darf_sehen());

-- Fehler: lesen alle, uebernehmen und abhaken darf, wer steuern darf -------
drop policy if exists "kk fehler lesen"     on public.kk_fehler;
drop policy if exists "kk fehler bearbeiten" on public.kk_fehler;
create policy "kk fehler lesen" on public.kk_fehler
  for select using (public.kk_darf_sehen());
create policy "kk fehler bearbeiten" on public.kk_fehler
  for update using (public.kk_darf_steuern()) with check (public.kk_darf_steuern());

-- Befehle: jeder sieht, was gesteuert wurde; ausloesen darf nur der Steuerer
drop policy if exists "kk befehle lesen"    on public.kk_befehle;
drop policy if exists "kk befehle ausloesen" on public.kk_befehle;
create policy "kk befehle lesen" on public.kk_befehle
  for select using (public.kk_darf_sehen());
create policy "kk befehle ausloesen" on public.kk_befehle
  for insert with check (public.kk_darf_steuern() and angefordert_von = public.kk_mitglied_id());

-- Protokoll: einsehbar, aber unveraenderlich (kein update, kein delete) ----
drop policy if exists "kk aktionen lesen"     on public.kk_aktionen;
drop policy if exists "kk aktionen schreiben" on public.kk_aktionen;
create policy "kk aktionen lesen" on public.kk_aktionen
  for select using (public.kk_darf_sehen());
create policy "kk aktionen schreiben" on public.kk_aktionen
  for insert with check (public.kk_darf_sehen() and mitglied_id = public.kk_mitglied_id());

-- Plenty-Daten: lesen ja, geschrieben wird ausschliesslich vom Abgleich ----
drop policy if exists "kk plenty artikel lesen"  on public.kk_plenty_artikel;
drop policy if exists "kk plenty abgleich lesen" on public.kk_plenty_abgleich;
create policy "kk plenty artikel lesen" on public.kk_plenty_artikel
  for select using (public.kk_darf_sehen());
create policy "kk plenty abgleich lesen" on public.kk_plenty_abgleich
  for select using (public.kk_darf_sehen());

-- ============================================================================
--  11. STARTBESTAND
-- ============================================================================
-- WICHTIG: Die E-Mail-Adresse unten muss die echte Anmelde-Adresse von
-- Amanuel Kheyo sein — sonst greift die Inhaber-Rolle beim ersten Login nicht.
-- Anpassen, bevor das Skript ausgefuehrt wird.
insert into public.kk_mitglieder (email, name, rolle)
values ('amanuel@komplett-konzept.de', 'Amanuel Kheyo', 'inhaber')
on conflict (email) do update set rolle = 'inhaber', aktiv = true;

-- Falls der Account schon existiert: sofort verknuepfen.
update public.kk_mitglieder m
   set benutzer_id = u.id
  from auth.users u
 where m.benutzer_id is null
   and lower(u.email) = lower(m.email);

insert into public.kk_systeme (schluessel, name, art, basis_url, konfiguration)
values (
  'plenty', 'PlentyONE', 'erp', 'https://p14443.my.plentysystems.com',
  jsonb_build_object('hinweis', 'Zugangsdaten liegen in den Server-Umgebungsvariablen PLENTY_USER / PLENTY_PASSWORD.')
)
on conflict (schluessel) do update set name = excluded.name, art = excluded.art;

insert into public.kk_automationen (
  schluessel, name, beschreibung, kategorie, system_id, status,
  zeitplan_cron, zeitplan_text, erwartete_dauer_ms, sortierung
)
values
  (
    'plenty-verbindung',
    'Plenty-Verbindung prüfen',
    'Meldet sich stündlich bei PlentyONE an und prüft, ob die Schnittstelle erreichbar ist.',
    'Bestand',
    (select id from public.kk_systeme where schluessel = 'plenty'),
    'aktiv', '5 * * * *', 'stündlich', 5000, 10
  ),
  (
    'plenty-bestandsabgleich',
    'Plenty-Bestandsabgleich',
    'Holt Artikel und Bestände aus PlentyONE und schreibt sie in die Datenbank.',
    'Bestand',
    (select id from public.kk_systeme where schluessel = 'plenty'),
    'aktiv', '*/30 * * * *', 'alle 30 Minuten', 120000, 20
  )
on conflict (schluessel) do update set
  name         = excluded.name,
  beschreibung = excluded.beschreibung,
  kategorie    = excluded.kategorie,
  system_id    = excluded.system_id;

update public.kk_automationen
   set verantwortlich_id = (select id from public.kk_mitglieder where rolle = 'inhaber' limit 1)
 where verantwortlich_id is null;

insert into public.kk_plenty_abgleich (schluessel)
values ('artikel')
on conflict (schluessel) do nothing;

-- Trigger erst jetzt anlegen: er greift auf kk_fehler zu.
drop trigger if exists kk_laeufe_status_nachziehen on public.kk_laeufe;
create trigger kk_laeufe_status_nachziehen
  after insert or update of status on public.kk_laeufe
  for each row execute function public.kk_automation_status_nachziehen();

-- ============================================================================
--  Fertig. Prüfen mit:  select * from public.kk_v_uebersicht;
-- ============================================================================
