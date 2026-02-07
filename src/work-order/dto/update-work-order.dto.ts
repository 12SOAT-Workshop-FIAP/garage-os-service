import {
  IsEnum,
  IsOptional,
  IsObject,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus } from '../entities/work-order.entity';

export class UpdateWorkOrderDto {
  @ApiProperty({ enum: WorkOrderStatus, required: false })
  @IsEnum(WorkOrderStatus)
  @IsOptional()
  status?: WorkOrderStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  actualCost?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  laborCost?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  partsCost?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  diagnosis?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  technicianNotes?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  customerApproval?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTechnicianId?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  estimatedCompletionDate?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  services?: any[];

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  parts?: any[];

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
