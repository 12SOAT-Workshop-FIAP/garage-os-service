import { IsString, IsNotEmpty, IsOptional, IsEnum, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PersonType } from '../entities/customer.entity';

export class CreateCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PersonType, example: PersonType.INDIVIDUAL })
  @IsEnum(PersonType)
  personType: PersonType;

  @ApiProperty({ example: '12345678901' })
  @IsString()
  @IsNotEmpty()
  document: string;

  @ApiProperty({ required: false, example: 'john@email.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '11999999999' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
