import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/jwt-auth.guard';
import { MessagingService } from '../messaging/messaging.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder } from '../work-order/entities/work-order.entity';
import { Response } from 'express';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private messagingService: MessagingService,
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check' })
  async check(@Res() res: Response) {
    const rabbitmqOk = this.messagingService.getConnectionStatus();

    let databaseOk = false;
    try {
      await this.workOrderRepository.query('SELECT 1');
      databaseOk = true;
    } catch {}

    const allOk = rabbitmqOk && databaseOk;
    const status = allOk ? 'ok' : 'degraded';
    const httpStatus = allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(httpStatus).json({
      status,
      service: 'os-service',
      timestamp: new Date().toISOString(),
      dependencies: {
        rabbitmq: rabbitmqOk ? 'connected' : 'disconnected',
        database: databaseOk ? 'connected' : 'disconnected',
      },
    });
  }
}
