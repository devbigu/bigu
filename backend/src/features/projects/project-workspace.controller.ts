import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { once } from 'node:events';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { CreateInstructionDto } from '../client-workspace/dto/create-instruction.dto';
import { ReviewChangeRequestDto } from '../client-workspace/dto/review-change-request.dto';
import { SendMessageDto } from '../client-workspace/dto/send-message.dto';
import { ProjectWorkspaceService } from './project-workspace.service';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class ProjectWorkspaceController {
  constructor(private readonly service: ProjectWorkspaceService) {}

  @Get('workspace')
  workspace(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.workspace(projectId, user.id);
  }

  @Post('messages')
  send(
    @Param('projectId') projectId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.send(projectId, dto.content, user.id);
  }

  @Post('messages/stream')
  async stream(
    @Param('projectId') projectId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once('aborted', abort);
    response.once('close', () => {
      if (!response.writableEnded) abort();
    });
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.socket?.setNoDelay(true);
    try {
      for await (const event of this.service.sendProjectMessage(
        projectId,
        dto.content,
        user.id,
        controller.signal,
      )) {
        if (response.destroyed || response.writableEnded) break;
        if (!response.write(JSON.stringify(event) + '\n'))
          await once(response, 'drain');
      }
    } finally {
      request.off('aborted', abort);
      if (!response.writableEnded && !response.destroyed) response.end();
    }
  }

  @Patch('change-requests/:requestId')
  review(
    @Param('projectId') projectId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.review(projectId, requestId, dto, user.id);
  }

  @Post('instructions')
  instruction(
    @Param('projectId') projectId: string,
    @Body() dto: CreateInstructionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.instruction(projectId, dto.title, dto.content, user.id);
  }

  @Patch('instructions/:instructionId/archive')
  archiveInstruction(
    @Param('projectId') projectId: string,
    @Param('instructionId') instructionId: string,
  ) {
    return this.service.archiveInstruction(projectId, instructionId);
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10485760 } }))
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(projectId, file, user.id);
  }

  @Get('files')
  files(@Param('projectId') projectId: string) {
    return this.service.files(projectId);
  }

  @Patch('files/:fileId/approve')
  approve(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.fileStatus(projectId, fileId, 'APPROVED', user.id);
  }

  @Patch('files/:fileId/reject')
  reject(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.fileStatus(projectId, fileId, 'REJECTED', user.id);
  }
}
