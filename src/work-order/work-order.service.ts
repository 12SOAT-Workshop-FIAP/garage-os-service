import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrder, WorkOrderStatus } from './entities/work-order.entity';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class WorkOrderService {
  constructor(
    @InjectRepository(WorkOrder)
    private workOrderRepository: Repository<WorkOrder>,
    private messagingService: MessagingService,
  ) {}

  async create(createDto: CreateWorkOrderDto): Promise<WorkOrder> {
    const workOrder = this.workOrderRepository.create(createDto);
    const saved = await this.workOrderRepository.save(workOrder);

    await this.messagingService.publish('work-order.created', {
      workOrderId: saved.id,
      customerId: saved.customerId,
      vehicleId: saved.vehicleId,
      description: saved.description,
      estimatedCost: saved.estimatedCost,
      timestamp: new Date().toISOString(),
    });

    return saved;
  }

  async findAll(): Promise<WorkOrder[]> {
    return this.workOrderRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findByStatus(status: WorkOrderStatus): Promise<WorkOrder[]> {
    return this.workOrderRepository.find({ where: { status }, order: { createdAt: 'DESC' } });
  }

  async findByCustomer(customerId: number): Promise<WorkOrder[]> {
    return this.workOrderRepository.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }

  async findByVehicle(vehicleId: number): Promise<WorkOrder[]> {
    return this.workOrderRepository.find({ where: { vehicleId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<WorkOrder> {
    const workOrder = await this.workOrderRepository.findOne({ where: { id } });
    if (!workOrder) {
      throw new NotFoundException(`Work order ${id} not found`);
    }
    return workOrder;
  }

  async update(id: string, updateDto: UpdateWorkOrderDto): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    const previousStatus = workOrder.status;

    Object.assign(workOrder, updateDto);

    if (updateDto.status === WorkOrderStatus.COMPLETED) {
      workOrder.completedAt = new Date();
    }

    const updated = await this.workOrderRepository.save(workOrder);

    if (previousStatus !== updateDto.status) {
      await this.messagingService.publish('work-order.status-changed', {
        workOrderId: updated.id,
        previousStatus,
        newStatus: updated.status,
        timestamp: new Date().toISOString(),
      });
    }

    return updated;
  }

  async approve(id: string): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    workOrder.customerApproval = true;
    workOrder.status = WorkOrderStatus.APPROVED;
    const updated = await this.workOrderRepository.save(workOrder);

    await this.messagingService.publish('work-order.approved', {
      workOrderId: updated.id,
      customerId: updated.customerId,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  async updateStatus(id: string, status: WorkOrderStatus): Promise<WorkOrder> {
    return this.update(id, { status });
  }

  async getHistory(id: string): Promise<any> {
    const workOrder = await this.findOne(id);
    return {
      workOrder,
      timeline: [
        { status: 'CREATED', timestamp: workOrder.createdAt },
        ...(workOrder.completedAt
          ? [{ status: 'COMPLETED', timestamp: workOrder.completedAt }]
          : []),
      ],
    };
  }

  async getPublicStatus(id: string, _document: string): Promise<any> {
    const workOrder = await this.findOne(id);
    return {
      id: workOrder.id,
      status: workOrder.status,
      description: workOrder.description,
      estimatedCost: workOrder.estimatedCost,
      createdAt: workOrder.createdAt,
      estimatedCompletionDate: workOrder.estimatedCompletionDate,
    };
  }

  async cancelWorkOrder(id: string): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);
    workOrder.status = WorkOrderStatus.CANCELLED;
    const updated = await this.workOrderRepository.save(workOrder);

    await this.messagingService.publish('work-order.cancelled', {
      workOrderId: updated.id,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }
}
