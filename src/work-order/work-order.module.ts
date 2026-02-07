import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderService } from './work-order.service';
import { WorkOrderController, PublicWorkOrderController } from './work-order.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [TypeOrmModule.forFeature([WorkOrder]), MessagingModule],
  controllers: [WorkOrderController, PublicWorkOrderController],
  providers: [WorkOrderService],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
