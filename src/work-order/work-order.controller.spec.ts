import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrderController } from './work-order.controller';
import { WorkOrderService } from './work-order.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrderStatus } from './entities/work-order.entity';

describe('WorkOrderController', () => {
  let controller: WorkOrderController;

  const mockWorkOrderService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByStatus: jest.fn(),
    findByCustomer: jest.fn(),
    findByVehicle: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    approve: jest.fn(),
    cancelWorkOrder: jest.fn(),
    getHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrderController],
      providers: [{ provide: WorkOrderService, useValue: mockWorkOrderService }],
    }).compile();

    controller = module.get<WorkOrderController>(WorkOrderController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a work order', async () => {
      const createDto: CreateWorkOrderDto = {
        customerId: 1,
        vehicleId: 1,
        description: 'Test service',
      };
      const expected = { id: 'uuid-1', ...createDto, status: WorkOrderStatus.PENDING };
      mockWorkOrderService.create.mockResolvedValue(expected);

      const result = await controller.create(createDto);
      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return all work orders', async () => {
      mockWorkOrderService.findAll.mockResolvedValue([{ id: '1' }]);
      const result = await controller.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockWorkOrderService.findByStatus.mockResolvedValue([{ id: '1' }]);
      await controller.findAll(WorkOrderStatus.PENDING);
      expect(mockWorkOrderService.findByStatus).toHaveBeenCalledWith(WorkOrderStatus.PENDING);
    });

    it('should filter by customerId', async () => {
      mockWorkOrderService.findByCustomer.mockResolvedValue([{ id: '1' }]);
      await controller.findAll(undefined, '1');
      expect(mockWorkOrderService.findByCustomer).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('should return a work order by id', async () => {
      mockWorkOrderService.findOne.mockResolvedValue({ id: '1' });
      const result = await controller.findOne('1');
      expect(result.id).toBe('1');
    });
  });

  describe('update', () => {
    it('should update a work order', async () => {
      const updateDto: UpdateWorkOrderDto = { status: WorkOrderStatus.IN_PROGRESS };
      mockWorkOrderService.update.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.IN_PROGRESS,
      });
      const result = await controller.update('1', updateDto);
      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });
  });

  describe('approve', () => {
    it('should approve a work order', async () => {
      mockWorkOrderService.approve.mockResolvedValue({ id: '1', status: WorkOrderStatus.APPROVED });
      const result = await controller.approve('1');
      expect(result.status).toBe(WorkOrderStatus.APPROVED);
    });
  });

  describe('cancel', () => {
    it('should cancel a work order', async () => {
      mockWorkOrderService.cancelWorkOrder.mockResolvedValue({
        id: '1',
        status: WorkOrderStatus.CANCELLED,
      });
      const result = await controller.cancel('1');
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    });
  });

  describe('getHistory', () => {
    it('should return work order history', async () => {
      mockWorkOrderService.getHistory.mockResolvedValue({ workOrder: { id: '1' }, timeline: [] });
      const result = await controller.getHistory('1');
      expect(result).toHaveProperty('workOrder');
    });
  });
});
