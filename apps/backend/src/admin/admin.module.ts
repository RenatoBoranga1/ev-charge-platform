import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChargingModule } from '../charging/charging.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminPermissionGuard } from './access/admin-permission.guard';
import { AdminAuthController } from './access/admin-auth.controller';
import { AdminAuthService } from './access/admin-auth.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminAuditService } from './audit/admin-audit.service';

@Module({
  controllers: [AdminAuthController, AdminOperationsController],
  imports: [AuthModule, ChargingModule, OutboxModule, PaymentsModule],
  providers: [
    AdminAuditService,
    AdminAuthService,
    AdminOperationsService,
    AdminPermissionGuard,
  ],
})
export class AdminModule {}
