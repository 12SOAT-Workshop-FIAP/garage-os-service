import { Module, forwardRef } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { WorkOrderModule } from '../work-order/work-order.module';

@Module({
  imports: [forwardRef(() => WorkOrderModule)],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
