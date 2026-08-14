import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { QUOTE_LANGUAGES } from "@youman/shared";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/tenant.decorator";
import { TemplatesService } from "./templates.service";
import { MissingFieldsError, RenderError, TemplateParseError } from "./errors";

interface JwtUser {
  sub: string;
  tenantId: string;
  role: string;
}

const DOCUMENT_TYPES = ["OFFER", "INVOICE", "ORDER_CONFIRMATION", "DELIVERY_NOTE", "OTHER"] as const;

const UploadMetaSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(120),
  documentType: z.enum(DOCUMENT_TYPES),
  language: z.enum(QUOTE_LANGUAGES).default("de"),
});

const RenameSchema = z.object({ name: z.string().min(1).max(120) });

const RenderSchema = z.object({
  data: z.record(z.unknown()),
  language: z.enum(QUOTE_LANGUAGES).default("de"),
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags("templates")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  /** All roles may list templates (needed to know whether documents can be produced). */
  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.templates.list(user.tenantId);
  }

  @Post()
  @Roles("TENANT_ADMIN")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown
  ) {
    if (!file) throw new BadRequestException("Keine Datei hochgeladen (Feld 'file').");
    if (!file.originalname.toLowerCase().endsWith(".docx")) {
      throw new BadRequestException("Nur .docx-Dateien werden unterstützt.");
    }
    const meta = UploadMetaSchema.parse(body);
    return this.wrapTemplateErrors(() =>
      this.templates.upload(user.tenantId, user.sub, {
        name: meta.name,
        documentType: meta.documentType,
        fileName: file.originalname,
        fileData: file.buffer,
        language: meta.language,
      })
    );
  }

  @Patch(":id")
  @Roles("TENANT_ADMIN")
  rename(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() body: unknown) {
    const { name } = RenameSchema.parse(body);
    return this.templates.rename(user.tenantId, id, name);
  }

  @Post(":id/default")
  @Roles("TENANT_ADMIN")
  @HttpCode(200)
  setDefault(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.templates.setDefault(user.tenantId, id);
  }

  @Delete(":id")
  @Roles("TENANT_ADMIN")
  async remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    await this.templates.remove(user.tenantId, user.sub, id);
    return { deleted: true };
  }

  /** Renders a document; format=docx|pdf. 422 lists uncovered placeholders. */
  @Post(":id/render")
  @HttpCode(200)
  async render(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Query("format") format: string | undefined,
    @Body() body: unknown,
    @Res() res: Response
  ) {
    const fmt = format === "pdf" ? "pdf" : "docx";
    const { data, language } = RenderSchema.parse(body);
    const rendered = await this.wrapTemplateErrors(() =>
      this.templates.render(user.tenantId, user.sub, id, data, fmt, language)
    );
    res
      .setHeader("Content-Type", rendered.contentType)
      .setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(rendered.fileName)}"`)
      .send(rendered.content);
  }

  /** Maps typed template errors onto proper HTTP responses. */
  private async wrapTemplateErrors<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof MissingFieldsError) {
        throw new UnprocessableEntityException({
          message: err.message,
          code: err.code,
          fields: err.fields,
        });
      }
      if (err instanceof TemplateParseError) {
        throw new BadRequestException({ message: err.message, code: err.code });
      }
      if (err instanceof RenderError) {
        throw new UnprocessableEntityException({ message: err.message, code: err.code });
      }
      throw err;
    }
  }
}
