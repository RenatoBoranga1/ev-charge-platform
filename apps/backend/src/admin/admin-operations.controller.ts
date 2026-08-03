import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser, type AuthUser } from '../auth/auth-user';
import type { CorrelatedRequest } from '../common/correlation-id.middleware';
import {
  CurrentAdmin,
  RequireAdminPermissions,
  type AdminActor,
  type AdminRequest,
} from './access/admin-access';
import { AdminPermissionGuard } from './access/admin-permission.guard';
import { AdminOperationsService } from './admin-operations.service';
import {
  AdminListQueryDto,
  AssignOperatorRolesDto,
  ConnectorStatusDto,
  CreateStationDto,
  CreateTariffDto,
  DriverActionDto,
  InviteOperatorDto,
  RefundPaymentDto,
  RemoteCommandDto,
  UpdateStationDto,
} from './dto/admin.dto';

function requiredIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || key.length > 160) {
    throw new BadRequestException('Idempotency-Key obrigatória e limitada a 160 caracteres.');
  }
  return key;
}

function requestContext(request: AdminRequest & CorrelatedRequest) {
  return {
    correlationId: request.correlationId,
    ipAddress: request.ip,
    userAgent: request.header('user-agent'),
  };
}

@ApiBearerAuth()
@ApiTags('admin')
@UseGuards(AdminPermissionGuard)
@RequireAdminPermissions()
@Controller('v1/admin')
export class AdminOperationsController {
  constructor(private readonly admin: AdminOperationsService) {}

  @RequireAdminPermissions('stations.read')
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): unknown {
    return this.admin.dashboard(user.tenantId);
  }

  @RequireAdminPermissions('stations.read')
  @Get('map')
  map(@CurrentUser() user: AuthUser): unknown {
    return this.admin.map(user.tenantId);
  }

  @RequireAdminPermissions('stations.read')
  @Get('stations')
  stations(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listStations(user.tenantId, query);
  }

  @RequireAdminPermissions('stations.create')
  @Post('stations')
  createStation(
    @CurrentUser() user: AuthUser,
    @Body() input: CreateStationDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.createStation(
      user.tenantId,
      user.sub,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('stations.read')
  @Get('stations/:id')
  station(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): unknown {
    return this.admin.getStation(user.tenantId, id);
  }

  @RequireAdminPermissions('stations.update')
  @Put('stations/:id')
  updateStation(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateStationDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.updateStation(
      user.tenantId,
      user.sub,
      id,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('stations.archive')
  @Delete('stations/:id')
  archiveStation(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverActionDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.archiveStation(
      user.tenantId,
      user.sub,
      id,
      input.reason,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('charge_points.read')
  @Get('charge-points')
  chargePoints(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminListQueryDto,
  ): unknown {
    return this.admin.listChargePoints(user.tenantId, query);
  }

  @RequireAdminPermissions('connectors.manage')
  @Patch('connectors/:id/status')
  connectorStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ConnectorStatusDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.updateConnectorStatus(
      user.tenantId,
      user.sub,
      id,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('tariffs.read')
  @Get('tariffs')
  tariffs(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listTariffs(user.tenantId, query);
  }

  @RequireAdminPermissions('tariffs.create')
  @Post('tariffs')
  createTariff(
    @CurrentUser() user: AuthUser,
    @Body() input: CreateTariffDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.createTariff(
      user.tenantId,
      user.sub,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('tariffs.publish')
  @Post('tariffs/:id/publish')
  publishTariff(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.publishTariff(
      user.tenantId,
      user.sub,
      id,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('tariffs.archive')
  @Post('tariffs/:id/archive')
  archiveTariff(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverActionDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.archiveTariff(
      user.tenantId,
      user.sub,
      id,
      input.reason,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('sessions.read')
  @Get('charging-sessions')
  sessions(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listSessions(user.tenantId, query);
  }

  @RequireAdminPermissions('sessions.read')
  @Get('charging-sessions/:id')
  session(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): unknown {
    return this.admin.getSession(user.tenantId, id);
  }

  @RequireAdminPermissions('sessions.read')
  @Get('remote-commands')
  commands(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listCommands(user.tenantId, query);
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @RequireAdminPermissions('sessions.read')
  @Post('remote-commands')
  command(
    @CurrentUser() user: AuthUser,
    @CurrentAdmin() actor: AdminActor,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RemoteCommandDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.createCommand(
      user,
      actor,
      requiredIdempotencyKey(idempotencyKey),
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('drivers.read')
  @Get('drivers')
  drivers(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listDrivers(user.tenantId, query);
  }

  @RequireAdminPermissions('drivers.block')
  @Post('drivers/:id/block')
  blockDriver(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverActionDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.setDriverBlocked(
      user.tenantId,
      user.sub,
      id,
      true,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('drivers.unblock')
  @Post('drivers/:id/unblock')
  unblockDriver(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverActionDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.setDriverBlocked(
      user.tenantId,
      user.sub,
      id,
      false,
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('payments.read')
  @Get('payments')
  payments(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listPayments(user.tenantId, query);
  }

  @RequireAdminPermissions('payments.read')
  @Get('payments/:id')
  payment(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): unknown {
    return this.admin.getPayment(user.tenantId, id);
  }

  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @RequireAdminPermissions('payments.refund')
  @Post('payments/:id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: RefundPaymentDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.refundPayment(
      user,
      id,
      requiredIdempotencyKey(idempotencyKey),
      input,
      requestContext(request),
    );
  }

  @RequireAdminPermissions('payments.read')
  @Get('reconciliation')
  reconciliation(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminListQueryDto,
  ): unknown {
    return this.admin.listReconciliation(user.tenantId, query);
  }

  @RequireAdminPermissions('payments.reconcile')
  @Post('reconciliation/run')
  reconcile(
    @CurrentUser() user: AuthUser,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.reconcilePayments(user, requestContext(request));
  }

  @RequireAdminPermissions('users.read')
  @Get('operators')
  operators(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listOperators(user.tenantId, query);
  }

  @RequireAdminPermissions('users.invite')
  @Post('operators/invite')
  inviteOperator(
    @CurrentUser() user: AuthUser,
    @CurrentAdmin() actor: AdminActor,
    @Body() input: InviteOperatorDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.inviteOperator(user, actor, input, requestContext(request));
  }

  @RequireAdminPermissions('users.assign_roles')
  @Put('operators/:id/roles')
  assignRoles(
    @CurrentUser() user: AuthUser,
    @CurrentAdmin() actor: AdminActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: AssignOperatorRolesDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.assignRoles(user, actor, id, input, requestContext(request));
  }

  @RequireAdminPermissions('users.disable')
  @Post('operators/:id/disable')
  disableOperator(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: DriverActionDto,
    @Req() request: AdminRequest & CorrelatedRequest,
  ): unknown {
    return this.admin.disableOperator(user, id, input, requestContext(request));
  }

  @RequireAdminPermissions('audit.read')
  @Get('audit-logs')
  audit(@CurrentUser() user: AuthUser, @Query() query: AdminListQueryDto): unknown {
    return this.admin.listAudit(user.tenantId, query);
  }

  @RequireAdminPermissions('reports.export')
  @Get('reports/charging-sessions.csv')
  async report(
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.admin.exportSessionsCsv(user.tenantId);
    response
      .type('text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        'attachment; filename="solis-charging-sessions.csv"',
      )
      .send(csv);
  }
}
