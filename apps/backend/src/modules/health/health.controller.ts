import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SetMetadata } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../../database/prisma.service";

const Public = () => SetMetadata("isPublic", true);

@ApiTags("health")
@Controller("health")
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness — process is up. No DB check, used by orchestrators (Docker,
   * Railway) to decide whether the container needs a restart.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Liveness check" })
  liveness() {
    return { status: "ok", uptime: Math.round(process.uptime()) };
  }

  /**
   * Readiness — process is up AND database is reachable. Used to decide
   * whether the container should receive traffic. Returns 503 if DB is down.
   */
  @Get("ready")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Readiness check (incl. DB)" })
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", database: "ok" };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: "not-ready",
        database: "unreachable",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}
