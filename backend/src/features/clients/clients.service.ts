import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientInclude = {
  createdBy: { select: { id: true, name: true, username: true, email: true } },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClientDto, createdById: string) {
    return this.prisma.client.create({
      data: { ...dto, createdById },
      include: clientInclude,
    });
  }

  findAll(query: ListClientsQueryDto) {
    const where: Prisma.ClientWhereInput = {};
    if (query.status !== 'ALL')
      where.status = query.status ?? ClientStatus.ACTIVE;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { industry: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.findMany({
      where,
      include: clientInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: clientInclude,
    });
    if (!client) throw new NotFoundException('Client not found.');
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.ensureExists(id);
    return this.prisma.client.update({
      where: { id },
      data: dto,
      include: clientInclude,
    });
  }

  archive(id: string) {
    return this.setStatus(id, ClientStatus.ARCHIVED);
  }
  restore(id: string) {
    return this.setStatus(id, ClientStatus.ACTIVE);
  }

  private async setStatus(id: string, status: ClientStatus) {
    await this.ensureExists(id);
    return this.prisma.client.update({
      where: { id },
      data: { status },
      include: clientInclude,
    });
  }

  private async ensureExists(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found.');
  }
}
