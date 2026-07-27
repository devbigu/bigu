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
import { ClientWorkspaceService } from './client-workspace.service';
import { CreateInstructionDto } from './dto/create-instruction.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('clients/:clientId')
@UseGuards(JwtAuthGuard)
export class ClientWorkspaceController {
  constructor(private readonly service: ClientWorkspaceService) {}

  @Get('workspace')
  workspace(
    @Param('clientId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.workspace(id, user.id);
  }

  @Post('messages')
  send(
    @Param('clientId') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.send(id, dto.content, user.id);
  }

  @Post('messages/stream')
  async stream(
    @Param('clientId') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const prepared = await this.service.prepareStream(id, dto.content, user.id);
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

    try {
      for await (const event of this.service.streamPreparedMessage(
        prepared,
        controller.signal,
      )) {
        if (response.destroyed || response.writableEnded) break;
        if (!response.write(`${JSON.stringify(event)}\n`)) {
          await once(response, 'drain');
        }
      }
    } finally {
      request.off('aborted', abort);
      if (!response.writableEnded && !response.destroyed) response.end();
    }
  }

  @Patch('change-requests/:requestId')
  review(
    @Param('clientId') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.review(id, requestId, dto, user.id);
  }

  @Post('instructions')
  instruction(
    @Param('clientId') id: string,
    @Body() dto: CreateInstructionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.instruction(id, dto.title, dto.content, user.id);
  }

  @Patch('instructions/:instructionId/archive')
  archive(
    @Param('clientId') id: string,
    @Param('instructionId') instructionId: string,
  ) {
    return this.service.archiveInstruction(id, instructionId);
  }

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10_485_760 } }),
  )
  upload(
    @Param('clientId') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(id, file, user.id);
  }

  @Get('files')
  files(@Param('clientId') id: string) {
    return this.service.files(id);
  }

  @Patch('files/:fileId/approve')
  approve(@Param('clientId') id: string, @Param('fileId') fileId: string) {
    return this.service.fileStatus(id, fileId, 'APPROVED');
  }

  @Patch('files/:fileId/reject')
  reject(@Param('clientId') id: string, @Param('fileId') fileId: string) {
    return this.service.fileStatus(id, fileId, 'REJECTED');
  }
}
