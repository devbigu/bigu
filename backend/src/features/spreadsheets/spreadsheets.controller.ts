import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { SpreadsheetsService } from './spreadsheets.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class SpreadsheetsController {
  constructor(private readonly spreadsheets: SpreadsheetsService) {}

  @Get('clients/:clientId/spreadsheet')
  clientSpreadsheet(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.getClientSpreadsheet(clientId, user);
  }

  @Post('clients/:clientId/spreadsheet/create')
  createClientSpreadsheet(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.createClientSpreadsheet(clientId, user);
  }

  @Post('clients/:clientId/spreadsheet/sync')
  syncClientSpreadsheet(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.requestClientSync(clientId, user);
  }

  @Get('projects/:projectId/spreadsheet')
  projectSpreadsheet(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.getProjectSpreadsheet(projectId, user);
  }

  @Post('projects/:projectId/spreadsheet/sync')
  syncProjectSpreadsheet(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.requestProjectSync(projectId, user);
  }

  @Get('projects/:projectId/spreadsheet/sync-jobs')
  projectSyncJobs(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.spreadsheets.projectSyncJobs(projectId, user);
  }

  @Get('projects/:projectId/export.xlsx')
  async exportProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const exported = await this.spreadsheets.exportProject(projectId, user);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(exported.buffer);
  }
}
