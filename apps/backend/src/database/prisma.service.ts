import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const CONNECT_MAX_ATTEMPTS = 10;
const CONNECT_RETRY_DELAY_MS = 5_000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
    });
  }

  async onModuleInit() {
    // Remote databases (e.g. Supabase pooler) are occasionally unreachable for
    // a few seconds; retry instead of crashing the whole backend on startup.
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        this.logger.log("Database connected");
        return;
      } catch (err) {
        if (attempt >= CONNECT_MAX_ATTEMPTS) throw err;
        this.logger.warn(
          `Datenbank nicht erreichbar (Versuch ${attempt}/${CONNECT_MAX_ATTEMPTS}) – neuer Versuch in ${CONNECT_RETRY_DELAY_MS / 1000} s: ${err instanceof Error ? err.message.split("\n")[0] : err}`
        );
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_DELAY_MS));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
