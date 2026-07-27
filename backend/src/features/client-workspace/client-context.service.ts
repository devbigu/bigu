import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
@Injectable()
export class ClientContextService {
  constructor(private readonly prisma: PrismaService) {}
  async build(clientId: string, currentMessage: string) {
    const client = await this.prisma.client.findUniqueOrThrow({
      where: { id: clientId },
    });
    const instructions = await this.prisma.clientInstruction.findMany({
      where: { clientId, projectId: null, status: 'ACTIVE' },
      select: { title: true, content: true },
    });
    const files = await this.prisma.clientFile.findMany({
      where: { clientId, projectId: null, processingStatus: 'APPROVED' },
      select: { originalName: true, extractedText: true },
      take: 3,
    });
    const messages = await this.prisma.message.findMany({
      where: { conversation: { clientId, projectId: null } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { senderType: true, content: true },
    });
    return {
      client: {
        id: client.id,
        name: client.name,
        industry: client.industry,
        description: client.description,
        targetAudience: client.targetAudience,
        brandVoice: client.brandVoice,
        websiteUrl: client.websiteUrl,
        instagramUrl: client.instagramUrl,
        facebookUrl: client.facebookUrl,
        businessObjectives: client.businessObjectives,
      },
      instructions,
      approvedFiles: files.map((x) => ({
        name: x.originalName,
        extractedText: (x.extractedText ?? '').slice(0, 4000),
      })),
      recentMessages: messages
        .reverse()
        .filter((x) => x.senderType !== 'SYSTEM')
        .map((x) => ({
          role:
            x.senderType === 'USER'
              ? ('user' as const)
              : ('assistant' as const),
          content: x.content.slice(0, 1200),
        })),
      currentMessage,
    };
  }
}
