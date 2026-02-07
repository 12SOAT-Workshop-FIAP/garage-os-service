import { Test, TestingModule } from '@nestjs/testing';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

describe('VehicleController', () => {
  let controller: VehicleController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCustomer: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [{ provide: VehicleService, useValue: mockService }],
    }).compile();
    controller = module.get<VehicleController>(VehicleController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a vehicle', async () => {
    mockService.create.mockResolvedValue({ id: 1, plate: 'ABC1D23' });
    const result = await controller.create({ plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla', year: 2024, customerId: 1 });
    expect(result.plate).toBe('ABC1D23');
  });

  it('should list all vehicles', async () => {
    mockService.findAll.mockResolvedValue([{ id: 1 }]);
    expect(await controller.findAll()).toHaveLength(1);
  });

  it('should find vehicles by customer', async () => {
    mockService.findByCustomer.mockResolvedValue([{ id: 1 }]);
    expect(await controller.findByCustomer(1)).toHaveLength(1);
  });

  it('should find vehicle by id', async () => {
    mockService.findOne.mockResolvedValue({ id: 1 });
    expect((await controller.findOne(1)).id).toBe(1);
  });

  it('should update a vehicle', async () => {
    mockService.update.mockResolvedValue({ id: 1, brand: 'Honda' });
    expect((await controller.update(1, { brand: 'Honda' })).brand).toBe('Honda');
  });

  it('should delete a vehicle', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await expect(controller.remove(1)).resolves.toBeUndefined();
  });
});
