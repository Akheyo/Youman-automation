import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { firstName: "asc" },
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
  }
}
