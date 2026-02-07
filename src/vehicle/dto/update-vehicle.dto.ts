import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateVehicleDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  plate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  year?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  customerId?: number;
}
