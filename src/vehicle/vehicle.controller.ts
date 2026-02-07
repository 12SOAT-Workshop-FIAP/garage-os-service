import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiResponse({ status: HttpStatus.CREATED })
  create(@Body() createDto: CreateVehicleDto) {
    return this.vehicleService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all vehicles' })
  findAll() {
    return this.vehicleService.findAll();
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Get vehicles by customer' })
  findByCustomer(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.vehicleService.findByCustomer(customerId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update vehicle' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateVehicleDto) {
    return this.vehicleService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete vehicle' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleService.remove(id);
  }
}
