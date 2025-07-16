import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GhlService } from './ghl.service';
import { AuthReq, CreateInstanceDto, UpdateInstanceDto } from '../types';
import { GhlContextGuard } from './guards/ghl-context.guard';

@Controller('api/instances')
@UseGuards(GhlContextGuard)
export class GhlController {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly ghlService: GhlService,
  ) {}

  @Get()
  async getInstances(@Req() req: AuthReq) {
    const { locationId } = req;
    this.logger.log(`Getting instances for location: ${locationId}`);
    const instances = await this.prisma.getInstancesByUserId(locationId);
    return {
      success: true,
      instances: instances.map((instance) => ({
        id: instance.idInstance,
        name: instance.name,
        state: instance.stateInstance,
        createdAt: instance.createdAt,
      })),
    };
  }

  @Post()
  async createInstance(@Req() req: AuthReq, @Body() dto: CreateInstanceDto) {
    const { locationId } = req;
    this.logger.log(`Creating instance for location: ${locationId}`);

    // La validación del DTO se puede hacer con Pipes de NestJS en el futuro
    if (!dto.instanceId || !dto.apiToken) {
        throw new HttpException('Instance ID and API Token are required', HttpStatus.BAD_REQUEST);
    }
    
    // El GhlContextGuard ya asegura que el locationId es el correcto
    dto.locationId = locationId;

    try {
      const instance = await this.ghlService.createEvolutionApiInstanceForUser(
        dto.locationId,
        dto.instanceId,
        dto.apiToken,
        dto.name,
      );
      return {
        success: true,
        instance,
      };
    } catch (error) {
      this.logger.error(`Error creating instance: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to create instance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':instanceId')
  async deleteInstance(@Param('instanceId') instanceId: string, @Req() req: AuthReq) {
    const { locationId } = req;
    this.logger.log(`Attempting to delete instance: ${instanceId} for location: ${locationId}`);

    const instance = await this.prisma.getInstance(instanceId);
    if (!instance || instance.userId !== locationId) {
      throw new HttpException('Instance not found or not authorized for this location', HttpStatus.FORBIDDEN);
    }

    await this.prisma.removeInstance(instanceId);

    return {
      success: true,
      message: 'Instance deleted successfully',
    };
  }

  @Patch(':instanceId')
  async updateInstance(
    @Param('instanceId') instanceId: string,
    @Body() dto: UpdateInstanceDto,
    @Req() req: AuthReq,
  ) {
    const { locationId } = req;
    this.logger.log(`Updating instance: ${instanceId}`);

    const instance = await this.prisma.getInstance(instanceId);
    if (!instance || instance.userId !== locationId) {
      throw new HttpException('Instance not found or not authorized for this location', HttpStatus.FORBIDDEN);
    }
    
    // La llamada ahora es correcta porque 'updateInstanceName' ya existe en PrismaService.
    const updatedInstance = await this.prisma.updateInstanceName(instanceId, dto.name);

    return {
      success: true,
      instance: updatedInstance,
    };
  }
}
