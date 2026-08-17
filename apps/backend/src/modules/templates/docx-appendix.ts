import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import { Logger } from "@nestjs/common";
import { packageDocx } from "./docx-engine";

const logger = new Logger("DocxAppendix");

/**
 * Statischer AGB-Anhang für DOCX: dieselben 4 AGB-Seiten wie beim PDF, nur als
 * Word-Dokument (configs/templates/agb-b2b.docx). Wie beim PDF sprachunabhängig:
 * Es gilt die geprüfte deutsche Fassung, auch hinter einem englischen Angebot. Pfad per AGB_DOCX_PATH
 * überschreibbar.
 */
function agbDocxPath(): string | null {
  const candidates = [
    process.env["AGB_DOCX_PATH"],
    resolve(process.cwd(), "../../configs/templates/agb-b2b.docx"),
    resolve(process.cwd(), "configs/templates/agb-b2b.docx"),
    resolve(__dirname, "../../../../../configs/templates/agb-b2b.docx"),
    resolve(__dirname, "../../../../../../configs/templates/agb-b2b.docx"),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(p)) ?? null;
}

let cachedAgb: Buffer | null = null;
let agbResolved = false;

function loadAgb(): Buffer | null {
  if (agbResolved) return cachedAgb;
  agbResolved = true;
  const path = agbDocxPath();
  if (!path) {
    logger.warn("AGB-DOCX (configs/templates/agb-b2b.docx) nicht gefunden – Angebote werden OHNE AGB-Anhang erzeugt.");
    return null;
  }
  try {
    cachedAgb = readFileSync(path);
  } catch (err) {
    logger.error(`AGB-DOCX konnte nicht gelesen werden: ${err instanceof Error ? err.message : err}`);
    cachedAgb = null;
  }
  return cachedAgb;
}

/** Leere Kopf-/Fußzeile: Der Briefbogen des Angebots darf nicht über die AGB laufen. */
const EMPTY_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:hdr>';
const EMPTY_FOOTER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>';

const AGB_HEADER_PART = "word/headerAgb.xml";
const AGB_FOOTER_PART = "word/footerAgb.xml";

/**
 * NUMPAGES zählt das ganze Dokument – hinter einem Angebot stünde in den AGB
 * also "Seite 1 von 5" statt "Seite 1 von 4". SECTIONPAGES zählt nur den
 * eigenen Abschnitt und liefert damit dieselbe Zählung wie die AGB-PDF.
 *
 * Das zwischengespeicherte Feldergebnis der Vorlage bleibt stehen: Ein Programm,
 * das SECTIONPAGES nicht kennt, zeigt weiterhin die zuletzt berechnete Zahl.
 */
function scopePageCountToSection(footerXml: string): string {
  return footerXml.replace(
    /(<w:instrText[^>]*>[^<]*?)NUMPAGES([^<]*<\/w:instrText>)/g,
    "$1SECTIONPAGES$2"
  );
}

/** Erstes Vorkommen eines Tags, tolerant gegenüber der Attributreihenfolge. */
function refId(sectPr: string, tag: "headerReference" | "footerReference", type: string): string | null {
  for (const [, attrs] of sectPr.matchAll(new RegExp(`<w:${tag}([^>]*)/>`, "g"))) {
    if (!attrs!.includes(`w:type="${type}"`)) continue;
    const id = /r:id="(rId\d+)"/.exec(attrs!)?.[1];
    if (id) return id;
  }
  return null;
}

/**
 * Lässt die Seitenzählung im AGB-Abschnitt wieder bei 1 beginnen.
 *
 * Ohne das zählte PAGE über das Angebot hinweg weiter ("Seite 2 von 4").
 * Reihenfolge laut Schema: pgNumType steht hinter pgMar.
 */
function restartPageNumbers(sectPr: string): string {
  if (sectPr.includes("<w:pgNumType")) return sectPr;
  const start = '<w:pgNumType w:start="1"/>';
  const pgMar = /<w:pgMar[^>]*\/>/.exec(sectPr);
  return pgMar
    ? sectPr.replace(pgMar[0], pgMar[0] + start)
    : sectPr.replace("</w:sectPr>", `${start}</w:sectPr>`);
}

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT_NS = "application/vnd.openxmlformats-officedocument.wordprocessingml";

/** Erste freie rIdN in einer .rels-Datei. */
function nextRelId(rels: string): number {
  const used = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  return used.length > 0 ? Math.max(...used) + 1 : 1;
}

/** Fügt vor </Relationships> ein. */
function addRel(rels: string, id: string, type: string, target: string): string {
  return rels.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

/** Body-Inhalt ohne die abschließenden Abschnittseigenschaften. */
function splitBody(documentXml: string): { content: string; sectPr: string } {
  const start = documentXml.indexOf("<w:body>") + "<w:body>".length;
  const end = documentXml.lastIndexOf("</w:body>");
  const body = documentXml.slice(start, end);
  const sectAt = body.lastIndexOf("<w:sectPr");
  if (sectAt < 0) return { content: body, sectPr: "" };
  return { content: body.slice(0, sectAt), sectPr: body.slice(sectAt) };
}

/** Namensräume der Quelle ergänzen, die das Ziel noch nicht kennt. */
function mergeNamespaces(targetXml: string, sourceXml: string): string {
  const rootOf = (xml: string): string => {
    const at = xml.indexOf("<w:document");
    return xml.slice(at, xml.indexOf(">", at) + 1);
  };
  const targetRoot = rootOf(targetXml);
  const missing = [...rootOf(sourceXml).matchAll(/xmlns:(\w+)="([^"]+)"/g)]
    .filter(([, prefix]) => !targetRoot.includes(`xmlns:${prefix}=`))
    .map(([, prefix, uri]) => ` xmlns:${prefix}="${uri}"`)
    .join("");
  if (!missing) return targetXml;
  return targetXml.replace(targetRoot, targetRoot.slice(0, -1) + missing + ">");
}

/**
 * Hängt die statischen AGB-Seiten an ein Angebots-DOCX an.
 *
 * Die AGB kommen als eigener Abschnitt hinter das Angebot: eigene Seitenränder
 * und – über leere Kopf-/Fußzeilen – ohne den Briefbogen des Angebots. Bilder,
 * Beziehungs-IDs und Objekt-IDs der AGB werden dabei umgeschrieben, damit sie
 * nicht mit denen der Vorlage kollidieren.
 *
 * Best-effort wie beim PDF: Scheitert das Anhängen, kommt das unveränderte
 * Angebot zurück – ein AGB-Problem darf die Angebotserstellung nie verhindern.
 */
export function appendAgbDocx(offerDocx: Buffer): Buffer {
  const agbBytes = loadAgb();
  if (!agbBytes) return offerDocx;
  try {
    return merge(offerDocx, agbBytes);
  } catch (err) {
    logger.error(
      `AGB konnten nicht an das DOCX angehängt werden (Angebot bleibt ohne AGB): ${err instanceof Error ? err.message : err}`
    );
    return offerDocx;
  }
}

function merge(offerDocx: Buffer, agbBytes: Buffer): Buffer {
  const target = new PizZip(offerDocx);
  const agb = new PizZip(agbBytes);

  let targetDoc = target.file("word/document.xml")!.asText();
  const agbDoc = agb.file("word/document.xml")!.asText();
  let targetRels = target.file("word/_rels/document.xml.rels")!.asText();
  const agbRels = agb.file("word/_rels/document.xml.rels")!.asText();
  let contentTypes = target.file("[Content_Types].xml")!.asText();

  let relCounter = nextRelId(targetRels);
  let { content: agbContent, sectPr: agbSect } = splitBody(agbDoc);

  // 1. Bilder der AGB übernehmen und ihre Beziehungs-IDs umschreiben.
  const idMap = new Map<string, string>();
  for (const [, oldId, target_] of agbRels.matchAll(
    /Id="(rId\d+)"[^>]*Type="[^"]*\/image"[^>]*Target="([^"]+)"/g
  )) {
    const source = `word/${target_}`;
    const file = agb.file(source);
    if (!file) continue;
    const newName = `media/agb-${source.split("/").pop()}`;
    if (!target.file(`word/${newName}`)) target.file(`word/${newName}`, file.asNodeBuffer());
    const newId = `rId${relCounter++}`;
    idMap.set(oldId!, newId);
    targetRels = addRel(targetRels, newId, `${REL_NS}/image`, newName);

    const ext = source.split(".").pop()!.toLowerCase();
    if (!new RegExp(`Default Extension="${ext}"`, "i").test(contentTypes)) {
      contentTypes = contentTypes.replace(
        "<Override",
        `<Default Extension="${ext}" ContentType="image/${ext === "jpg" ? "jpeg" : ext}"/><Override`
      );
    }
  }
  // Längere IDs zuerst ersetzen, sonst trifft rId1 auch rId10.
  for (const [oldId, newId] of [...idMap].sort((a, b) => b[0].length - a[0].length)) {
    agbContent = agbContent.replaceAll(`r:embed="${oldId}"`, `r:embed="${newId}"`);
    agbContent = agbContent.replaceAll(`r:link="${oldId}"`, `r:link="${newId}"`);
  }

  // 2. Objekt-IDs eindeutig machen (Word verweigert doppelte docPr-IDs).
  let objectId = 900_000;
  agbContent = agbContent
    .replace(/<wp:docPr id="\d+"/g, () => `<wp:docPr id="${objectId++}"`)
    .replace(/<pic:cNvPr id="\d+"/g, () => `<pic:cNvPr id="${objectId++}"`);

  // 3. Kopf-/Fußzeile des AGB-Abschnitts.
  //
  //    Kopfzeile: immer leer, damit der Briefbogen des Angebots nicht auf den
  //    AGB-Seiten weiterläuft (Abschnitte erben ihn sonst vom vorherigen).
  //
  //    Fußzeile: die der AGB selbst, damit die Seitenzählung "Seite X von 4"
  //    erhalten bleibt – im PDF steht sie ja auch, weil dort die Original-Seiten
  //    angehängt werden. Nur wenn die AGB gar keine Fußzeile mitbringen, kommt
  //    eine leere, denn die des Angebots wäre hier falsch.
  const addOverride = (part: string, kind: "header" | "footer"): void => {
    if (contentTypes.includes(`PartName="/${part}"`)) return;
    contentTypes = contentTypes.replace(
      "</Types>",
      `<Override PartName="/${part}" ContentType="${CT_NS}.${kind}+xml"/></Types>`
    );
  };

  if (!target.file(AGB_HEADER_PART)) target.file(AGB_HEADER_PART, EMPTY_HEADER);
  const headerId = `rId${relCounter++}`;
  targetRels = addRel(targetRels, headerId, `${REL_NS}/header`, "headerAgb.xml");
  addOverride(AGB_HEADER_PART, "header");

  // Fußzeilen-Parts der AGB übernehmen; ihre Beziehungs-IDs gelten nur in der
  // AGB-Datei und zeigen im Angebot sonst auf eine ganz andere Datei.
  const footerIds = new Map<string, string>();
  for (const [, oldId, source] of agbRels.matchAll(
    /Id="(rId\d+)"[^>]*Type="[^"]*\/footer"[^>]*Target="([^"]+)"/g
  )) {
    const file = agb.file(`word/${source}`);
    if (!file) continue;
    const name = `agb-${source!.split("/").pop()}`;
    target.file(`word/${name}`, scopePageCountToSection(file.asText()));
    const newId = `rId${relCounter++}`;
    footerIds.set(oldId!, newId);
    targetRels = addRel(targetRels, newId, `${REL_NS}/footer`, name);
    addOverride(`word/${name}`, "footer");
  }

  let footerId = footerIds.get(refId(agbSect, "footerReference", "default") ?? "") ?? null;
  if (!footerId) {
    if (!target.file(AGB_FOOTER_PART)) target.file(AGB_FOOTER_PART, EMPTY_FOOTER);
    footerId = `rId${relCounter++}`;
    targetRels = addRel(targetRels, footerId, `${REL_NS}/footer`, "footerAgb.xml");
    addOverride(AGB_FOOTER_PART, "footer");
  }

  // Die mitgebrachten Verweise fliegen raus – sie zeigen ins AGB-Archiv –, die
  // eigenen kommen an den Anfang: headerReference/footerReference müssen laut
  // Schema die ersten Kinder von sectPr sein.
  const refs = `<w:headerReference w:type="default" r:id="${headerId}"/><w:footerReference w:type="default" r:id="${footerId}"/>`;
  agbSect = agbSect.replace(/<w:(?:header|footer)Reference[^>]*\/>/g, "");
  agbSect = agbSect
    ? agbSect.replace(/^<w:sectPr([^>]*)>/, (_m, attrs: string) => `<w:sectPr${attrs}>${refs}`)
    : `<w:sectPr>${refs}</w:sectPr>`;
  agbSect = restartPageNumbers(agbSect);

  // 4. Zusammensetzen: Angebotsinhalt, dessen Abschnittseigenschaften als
  //    Absatz-sectPr (beendet den ersten Abschnitt), dann die AGB.
  const { content: offerContent, sectPr: offerSect } = splitBody(targetDoc);
  const bodyStart = targetDoc.indexOf("<w:body>") + "<w:body>".length;
  const bodyEnd = targetDoc.lastIndexOf("</w:body>");
  const merged =
    offerContent +
    (offerSect ? `<w:p><w:pPr>${offerSect}</w:pPr></w:p>` : "") +
    agbContent +
    agbSect;
  targetDoc = targetDoc.slice(0, bodyStart) + merged + targetDoc.slice(bodyEnd);
  targetDoc = mergeNamespaces(targetDoc, agbDoc);

  target.file("word/document.xml", targetDoc);
  target.file("word/_rels/document.xml.rels", targetRels);
  target.file("[Content_Types].xml", contentTypes);

  return packageDocx(target);
}
