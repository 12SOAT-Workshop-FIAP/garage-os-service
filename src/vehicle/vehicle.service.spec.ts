import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VehicleService } from './vehicle.service';
import { Vehicle } from './entities/vehicle.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('VehicleService', () => {
  let service: VehicleService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleService,
        { provide: getRepositoryToken(Vehicle), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<VehicleService>(VehicleService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a vehicle', async () => {
      const dto = {
        plate: 'ABC1D23',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2024,
        customerId: 1,
      };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(dto);
      mockRepository.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);
      expect(result.plate).toBe('ABC1D23');
    });

    it('should throw ConflictException if plate exists', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({
          plate: 'ABC1D23',
          brand: 'Toyota',
          model: 'Corolla',
          year: 2024,
          customerId: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all vehicles', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a vehicle by id', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1, plate: 'ABC1D23' });
      const result = await service.findOne(1);
      expect(result.plate).toBe('ABC1D23');
    });

    it('should throw NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCustomer', () => {
    it('should return vehicles by customer', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1, customerId: 1 }]);
      const result = await service.findByCustomer(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update a vehicle', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1, brand: 'Toyota' });
      mockRepository.save.mockResolvedValue({ id: 1, brand: 'Honda' });
      const result = await service.update(1, { brand: 'Honda' });
      expect(result.brand).toBe('Honda');
    });
  });

  describe('remove', () => {
    it('should remove a vehicle', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1 });
      mockRepository.remove.mockResolvedValue(undefined);
      await expect(service.remove(1)).resolves.toBeUndefined();
    });
  });
});
