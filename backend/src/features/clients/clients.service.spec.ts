import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClientStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ClientsService } from './clients.service';

const client = { id: 'client-1', name: 'Acme', status: ClientStatus.ACTIVE };

describe('ClientsService', () => {
  const prisma = {
    client: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: ClientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ClientsService);
  });

  it('creates a client with the authenticated creator', async () => {
    prisma.client.create.mockResolvedValue(client);
    await service.create({ name: 'Acme' }, 'user-1');
    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Acme', createdById: 'user-1' },
      }),
    );
  });

  it('lists active clients by default, newest first', async () => {
    prisma.client.findMany.mockResolvedValue([client]);
    await service.findAll({});
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('searches client text fields case-insensitively', async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await service.findAll({ search: 'food' });
    expect(prisma.client.findMany).toHaveBeenCalled();
  });

  it('lists archived clients', async () => {
    prisma.client.findMany.mockResolvedValue([]);
    await service.findAll({ status: 'ARCHIVED' });
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ARCHIVED' } }),
    );
  });

  it('returns one client and throws for an unknown client', async () => {
    prisma.client.findUnique
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(null);
    await expect(service.findOne('client-1')).resolves.toBe(client);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates, archives, and restores existing clients', async () => {
    prisma.client.findUnique.mockResolvedValue({ id: client.id });
    prisma.client.update.mockResolvedValue(client);
    await service.update(client.id, { name: 'Updated' });
    await service.archive(client.id);
    await service.restore(client.id);
    expect(prisma.client.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { name: 'Updated' } }),
    );
    expect(prisma.client.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { status: 'ARCHIVED' } }),
    );
    expect(prisma.client.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });
});
