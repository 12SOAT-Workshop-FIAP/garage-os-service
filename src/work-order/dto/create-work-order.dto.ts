import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  customerId: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  vehicleId: number;

  @ApiProperty({ example: 'Oil change and filter replacement' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ required: false, example: 150.0 })
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTechnicianId?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  estimatedCompletionDate?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
