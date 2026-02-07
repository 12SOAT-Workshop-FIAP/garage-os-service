import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async create(createDto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepository.findOne({
      where: { document: createDto.document },
    });
    if (existing) {
      throw new ConflictException('Customer with this document already exists');
    }
    const customer = this.customerRepository.create(createDto);
    return this.customerRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async findByDocument(document: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({ where: { document } });
    if (!customer) {
      throw new NotFoundException(`Customer with document ${document} not found`);
    }
    return customer;
  }

  async update(id: number, updateDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateDto);
    return this.customerRepository.save(customer);
  }

  async remove(id: number): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepository.remove(customer);
  }
}
