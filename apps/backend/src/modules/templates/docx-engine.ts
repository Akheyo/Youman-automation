import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import { MissingFieldsError, RenderError, TemplateParseError } from "./errors";
import { formatValue } from "./formatters";

/** Placeholder syntax used in customer templates: {{feld}} / {{#loop}}…{{/loop}}. */
const DELIMITERS = { start: "{{", end: "}}" };

export interface TemplateStructure {
  /** Flat list: scalar tags plus loop tags and their children ("positionen.pos"). */
  placeholders: string[];
  /** Loop tags → their child tags. */
  loops: Record<string, string[]>;
  /** Scalar (non-loop) tags. */
  scalars: string[];
}

interface InspectTagTree {
  [tag: string]: InspectTagTree;
}

function newDoc(fileData: Buffer, modules: unknown[] = []): Docxtemplater {
  let zip: PizZip;
  try {
    zip = new PizZip(fileData);
  } catch (err) {
    throw new TemplateParseError(
      "Die Datei ist keine gültige DOCX-Datei (kein lesbares ZIP-Archiv). Bitte laden Sie eine in Word gespeicherte .docx-Datei hoch.",
      { cause: err }
    );
  }
  try {
    return new Docxtemplater(zip, {
      delimiters: DELIMITERS,
      linebreaks: true,
      modules: modules as never[],
    });
  } catch (err) {
    throw new TemplateParseError(describeDocxtemplaterError(err), { cause: err });
  }
}

/** Parses a DOCX and returns its placeholder structure. Throws TemplateParseError. */
export function extractTemplateStructure(fileData: Buffer): TemplateStructure {
  const inspect = InspectModule();
  newDoc(fileData, [inspect]);
  const tree = inspect.getAllTags() as InspectTagTree;

  const scalars: string[] = [];
  const loops: Record<string, string[]> = {};
  for (const [tag, children] of Object.entries(tree)) {
    const childTags = Object.keys(children);
    if (childTags.length > 0) loops[tag] = childTags;
    else scalars.push(tag);
  }
  const placeholders = [
    ...scalars,
    ...Object.entries(loops).flatMap(([loop, children]) => [loop, ...children.map((c) => `${loop}.${c}`)]),
  ];
  return { placeholders, loops, scalars };
}

/**
 * Checks that the data covers every placeholder of the template.
 * Missing fields are reported with dot notation for loop children.
 */
export function findMissingFields(structure: TemplateStructure, data: Record<string, unknown>): string[] {
  const missing: string[] = [];
  const isEmpty = (v: unknown): boolean => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

  for (const tag of structure.scalars) {
    if (isEmpty(data[tag])) missing.push(tag);
  }
  for (const [loop, children] of Object.entries(structure.loops)) {
    const value = data[loop];
    if (!Array.isArray(value)) {
      missing.push(loop);
      continue;
    }
    for (const child of children) {
      const anyMissing = value.some((item) => isEmpty((item as Record<string, unknown>)[child]));
      if (anyMissing) missing.push(`${loop}.${child}`);
    }
  }
  return missing;
}

/** Applies German formatting (numbers, dates) to all scalar values and loop items. */
export function formatTemplateData(
  structure: TemplateStructure,
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const tag of structure.scalars) {
    out[tag] = formatValue(data[tag]) ?? "";
  }
  for (const [loop, children] of Object.entries(structure.loops)) {
    const rows = Array.isArray(data[loop]) ? (data[loop] as Record<string, unknown>[]) : [];
    out[loop] = rows.map((item) => {
      const row: Record<string, unknown> = {};
      for (const child of children) row[child] = formatValue(item[child]) ?? "";
      return row;
    });
  }
  return out;
}

/**
 * Fills the template with the given data and returns the resulting DOCX.
 * Validates coverage first – incomplete data throws MissingFieldsError.
 */
export function renderDocx(fileData: Buffer, data: Record<string, unknown>): Buffer {
  const structure = extractTemplateStructure(fileData);
  const missing = findMissingFields(structure, data);
  if (missing.length > 0) throw new MissingFieldsError(missing);

  const doc = newDoc(fileData);
  try {
    doc.render(formatTemplateData(structure, data));
  } catch (err) {
    throw new RenderError(describeDocxtemplaterError(err), { cause: err });
  }
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** LibreOffice binary; overridable for tests/odd installs. */
const SOFFICE_BIN = process.env["SOFFICE_BIN"] ?? "soffice";
const SOFFICE_TIMEOUT_MS = 120_000;

// LibreOffice can't run two conversions with the same profile concurrently –
// serialize all conversions through one chain.
let conversionChain: Promise<unknown> = Promise.resolve();

/**
 * Converts a DOCX buffer to PDF via LibreOffice headless.
 * Throws RenderError with a clear message when LibreOffice is unavailable
 * (see docs/DOKUMENTVORLAGEN.md for the deployment requirement).
 */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const run = async (): Promise<Buffer> => {
    const startedAt = Date.now();
    const dir = await mkdtemp(join(tmpdir(), "adept-doc-"));
    try {
      const docxPath = join(dir, "document.docx");
      await writeFile(docxPath, docx);
      await new Promise<void>((resolve, reject) => {
        execFile(
          SOFFICE_BIN,
          [
            `-env:UserInstallation=file://${join(dir, "lo-profile")}`,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            dir,
            docxPath,
          ],
          { timeout: SOFFICE_TIMEOUT_MS },
          (err, _stdout, stderr) => {
            if (err) {
              const hint = (err as NodeJS.ErrnoException).code === "ENOENT"
                ? "LibreOffice ist auf dem Server nicht installiert – PDF-Ausgabe ist nicht verfügbar (DOCX funktioniert weiterhin)."
                : `LibreOffice-Konvertierung fehlgeschlagen: ${stderr || err.message}`;
              reject(new RenderError(hint, { cause: err }));
            } else resolve();
          }
        );
      });
      try {
        const pdf = await readFile(join(dir, "document.pdf"));
        // eslint-disable-next-line no-console
        console.log(`PDF-Konvertierung: ${Date.now() - startedAt} ms (${pdf.length} Bytes)`);
        return pdf;
      } catch (err) {
        throw new RenderError("LibreOffice hat keine PDF-Datei erzeugt.", { cause: err });
      }
    } finally {
      void rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };

  const result = conversionChain.then(run, run);
  conversionChain = result.catch(() => undefined);
  return result;
}

function describeDocxtemplaterError(err: unknown): string {
  const e = err as { properties?: { errors?: Array<{ properties?: { explanation?: string } }>; explanation?: string }; message?: string };
  const explanations =
    e.properties?.errors?.map((sub) => sub.properties?.explanation).filter((x): x is string => !!x) ?? [];
  if (e.properties?.explanation) explanations.unshift(e.properties.explanation);
  if (explanations.length > 0) return `Vorlage fehlerhaft: ${[...new Set(explanations)].join("; ")}`;
  return `Vorlage konnte nicht verarbeitet werden: ${e.message ?? String(err)}`;
}
