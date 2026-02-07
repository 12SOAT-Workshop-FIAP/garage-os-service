import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { Customer, PersonType } from './entities/customer.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CustomerService', () => {
  let service: CustomerService;

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
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a customer', async () => {
      const dto = {
        name: 'John',
        personType: PersonType.INDIVIDUAL,
        document: '12345678901',
        phone: '11999',
      };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(dto);
      mockRepository.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.create(dto);
      expect(result.id).toBe(1);
      expect(result.name).toBe('John');
    });

    it('should throw ConflictException if document exists', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({
          name: 'John',
          personType: PersonType.INDIVIDUAL,
          document: '12345678901',
          phone: '11999',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all customers', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return a customer by id', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1, name: 'John' });
      const result = await service.findOne(1);
      expect(result.name).toBe('John');
    });

    it('should throw NotFoundException', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByDocument', () => {
    it('should return customer by document', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1, document: '123' });
      const result = await service.findByDocument('123');
      expect(result.document).toBe('123');
    });
  });

  describe('update', () => {
    it('should update a customer', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1, name: 'John' });
      mockRepository.save.mockResolvedValue({ id: 1, name: 'Jane' });
      const result = await service.update(1, { name: 'Jane' });
      expect(result.name).toBe('Jane');
    });
  });

  describe('remove', () => {
    it('should remove a customer', async () => {
      mockRepository.findOne.mockResolvedValue({ id: 1 });
      mockRepository.remove.mockResolvedValue(undefined);
      await expect(service.remove(1)).resolves.toBeUndefined();
    });
  });
});
