/** Typed errors of the document-template subsystem. */

/** The uploaded file is not a usable DOCX template. */
export class TemplateParseError extends Error {
  readonly code = "TEMPLATE_PARSE_ERROR";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TemplateParseError";
  }
}

/** Rendering was refused because placeholders are not covered by the data. */
export class MissingFieldsError extends Error {
  readonly code = "MISSING_FIELDS";
  readonly fields: string[];

  constructor(fields: string[]) {
    super(`Folgende Platzhalter sind nicht befüllt: ${fields.join(", ")}`);
    this.name = "MissingFieldsError";
    this.fields = fields;
  }
}

/** Filling the template or converting it to PDF failed. */
export class RenderError extends Error {
  readonly code = "RENDER_ERROR";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RenderError";
  }
}
