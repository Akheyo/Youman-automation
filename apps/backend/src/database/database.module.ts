import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { DemoSeedService } from "./demo-seed.service";

@Global()
@Module({
  providers: [PrismaService, DemoSeedService],
  exports: [PrismaService],
})
export class DatabaseModule {}
