import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { PersonType } from './entities/customer.entity';

describe('CustomerController', () => {
  let controller: CustomerController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByDocument: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [{ provide: CustomerService, useValue: mockService }],
    }).compile();
    controller = module.get<CustomerController>(CustomerController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should create a customer', async () => {
    const dto = { name: 'John', personType: PersonType.INDIVIDUAL, document: '123', phone: '11999' };
    mockService.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(dto);
    expect(result.id).toBe(1);
  });

  it('should list all customers', async () => {
    mockService.findAll.mockResolvedValue([{ id: 1 }]);
    expect(await controller.findAll()).toHaveLength(1);
  });

  it('should find customer by document', async () => {
    mockService.findByDocument.mockResolvedValue({ id: 1, document: '123' });
    const result = await controller.findByDocument('123');
    expect(result.document).toBe('123');
  });

  it('should find customer by id', async () => {
    mockService.findOne.mockResolvedValue({ id: 1 });
    const result = await controller.findOne(1);
    expect(result.id).toBe(1);
  });

  it('should update a customer', async () => {
    mockService.update.mockResolvedValue({ id: 1, name: 'Jane' });
    const result = await controller.update(1, { name: 'Jane' });
    expect(result.name).toBe('Jane');
  });

  it('should delete a customer', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await expect(controller.remove(1)).resolves.toBeUndefined();
  });
});
