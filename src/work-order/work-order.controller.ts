import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorkOrderService } from './work-order.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrderStatus } from './entities/work-order.entity';

@ApiTags('work-orders')
@Controller('work-orders')
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new work order' })
  @ApiResponse({ status: HttpStatus.CREATED })
  create(@Body() createDto: CreateWorkOrderDto) {
    return this.workOrderService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all work orders' })
  @ApiQuery({ name: 'status', required: false, enum: WorkOrderStatus })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(
    @Query('status') status?: WorkOrderStatus,
    @Query('customerId') customerId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    if (status) return this.workOrderService.findByStatus(status);
    if (customerId) return this.workOrderService.findByCustomer(Number(customerId));
    if (vehicleId) return this.workOrderService.findByVehicle(Number(vehicleId));
    return this.workOrderService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get work order by ID' })
  findOne(@Param('id') id: string) {
    return this.workOrderService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update work order' })
  update(@Param('id') id: string, @Body() updateDto: UpdateWorkOrderDto) {
    return this.workOrderService.update(id, updateDto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve work order' })
  approve(@Param('id') id: string) {
    return this.workOrderService.approve(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel work order' })
  cancel(@Param('id') id: string) {
    return this.workOrderService.cancelWorkOrder(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get work order history' })
  getHistory(@Param('id') id: string) {
    return this.workOrderService.getHistory(id);
  }
}

@ApiTags('public')
@Controller('public/work-orders')
export class PublicWorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get(':id/status')
  @ApiOperation({ summary: 'Get public work order status' })
  @ApiQuery({ name: 'document', required: true })
  getPublicStatus(@Param('id') id: string, @Query('document') document: string) {
    return this.workOrderService.getPublicStatus(id, document);
  }
}
