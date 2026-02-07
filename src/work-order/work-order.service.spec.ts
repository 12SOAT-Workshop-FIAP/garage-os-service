import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkOrderService } from './work-order.service';
import { WorkOrder, WorkOrderStatus } from './entities/work-order.entity';
import { MessagingService } from '../messaging/messaging.service';
import { NotFoundException } from '@nestjs/common';

describe('WorkOrderService', () => {
  let service: WorkOrderService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMessagingService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: getRepositoryToken(WorkOrder), useValue: mockRepository },
        { provide: MessagingService, useValue: mockMessagingService },
      ],
    }).compile();

    service = module.get<WorkOrderService>(WorkOrderService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a work order', async () => {
      const createDto = { customerId: 1, vehicleId: 1, description: 'Test service' };
      const mockWorkOrder = {
        id: 'uuid-1',
        ...createDto,
        status: WorkOrderStatus.PENDING,
        createdAt: new Date(),
      };
      mockRepository.create.mockReturnValue(mockWorkOrder);
      mockRepository.save.mockResolvedValue(mockWorkOrder);

      const result = await service.create(createDto);
      expect(result).toEqual(mockWorkOrder);
      expect(mockMessagingService.publish).toHaveBeenCalledWith(
        'work-order.created',
        expect.any(Object),
      );
    });
  });

  describe('findAll', () => {
    it('should return all work orders', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findByStatus', () => {
    it('should return work orders by status', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', status: WorkOrderStatus.PENDING }]);
      const result = await service.findByStatus(WorkOrderStatus.PENDING);
      expect(result).toHaveLength(1);
    });
  });

  describe('findByCustomer', () => {
    it('should return work orders by customer', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', customerId: 1 }]);
      const result = await service.findByCustomer(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findByVehicle', () => {
    it('should return work orders by vehicle', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', vehicleId: 1 }]);
      const result = await service.findByVehicle(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a work order by id', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', description: 'Test' });
      const result = await service.findOne('1');
      expect(result.description).toBe('Test');
    });

    it('should throw NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update work order status', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', status: WorkOrderStatus.PENDING });
      mockRepository.save.mockResolvedValue({ id: '1', status: WorkOrderStatus.IN_PROGRESS });

      const result = await service.update('1', { status: WorkOrderStatus.IN_PROGRESS });
      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
      expect(mockMessagingService.publish).toHaveBeenCalledWith(
        'work-order.status-changed',
        expect.any(Object),
      );
    });

    it('should set completedAt when status is COMPLETED', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', status: WorkOrderStatus.IN_PROGRESS });
      mockRepository.save.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.update('1', { status: WorkOrderStatus.COMPLETED });
      expect(result.status).toBe(WorkOrderStatus.COMPLETED);
    });
  });

  describe('approve', () => {
    it('should approve a work order', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.PENDING,
        customerApproval: false,
      });
      mockRepository.save.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.APPROVED,
        customerApproval: true,
      });

      const result = await service.approve('1');
      expect(result.customerApproval).toBe(true);
      expect(result.status).toBe(WorkOrderStatus.APPROVED);
      expect(mockMessagingService.publish).toHaveBeenCalledWith(
        'work-order.approved',
        expect.any(Object),
      );
    });
  });

  describe('cancelWorkOrder', () => {
    it('should cancel a work order', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', status: WorkOrderStatus.PENDING });
      mockRepository.save.mockResolvedValue({ id: '1', status: WorkOrderStatus.CANCELLED });

      const result = await service.cancelWorkOrder('1');
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
      expect(mockMessagingService.publish).toHaveBeenCalledWith(
        'work-order.cancelled',
        expect.any(Object),
      );
    });
  });

  describe('getHistory', () => {
    it('should return work order history', async () => {
      mockRepository.findOne.mockResolvedValue({ id: '1', createdAt: new Date() });
      const result = await service.getHistory('1');
      expect(result).toHaveProperty('workOrder');
      expect(result).toHaveProperty('timeline');
    });
  });

  describe('getPublicStatus', () => {
    it('should return public status info', async () => {
      mockRepository.findOne.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.PENDING,
        description: 'Test',
        estimatedCost: 100,
        createdAt: new Date(),
      });
      const result = await service.getPublicStatus('1', '12345678901');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).not.toHaveProperty('customerApproval');
    });
  });
});
