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
// Asegúrate de que los tipos se importen desde tu archivo central de tipos
import { AuthReq, CreateInstanceDto, UpdateInstanceDto } from '../types';
import { GhlContextGuard } from './guards/ghl-context.guard';

@Controller('api/instances')
@UseGuards(GhlContextGuard)
export class GhlController {
  private readonly logger = new Logger(GhlController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ghlService: GhlService,
  ) {}

  @Get() // Ruta simplificada para obtener instancias de la ubicación en contexto
  async getInstances(@Req() req: AuthReq) {
    const { locationId } = req;
    this.logger.log(`Getting instances for location: ${locationId}`);

    const instances = await this.prisma.getInstancesByUserId(locationId);

    return {
      success: true,
      instances: instances.map((instance) => ({
        id: instance.idInstance, // Usamos el ID de string
        name: instance.name || `Instance ${instance.idInstance}`,
        state: instance.stateInstance,
        createdAt: instance.createdAt,
      })),
    };
  }

  @Post()
  async createInstance(@Req() req: AuthReq, @Body() dto: CreateInstanceDto) {
    const { locationId } = req;
    // La validación del locationId ya la hace el GhlContextGuard, pero una doble verificación es segura
    if (locationId !== dto.locationId) {
      throw new HttpException('Unauthorized: Mismatched location ID', HttpStatus.FORBIDDEN);
    }
    this.logger.log(`Creating instance for location: ${locationId}`);

    try {
      // --- ESTA ES LA LLAMADA A LA FUNCIÓN CORREGIDA ---
      // Se pasan 4 argumentos, como espera la función del servicio.
      const instance = await this.ghlService.createEvolutionApiInstanceForUser(
        locationId,
        dto.instanceId,
        dto.apiToken,
        dto.name, // El nombre es el cuarto argumento opcional.
      );

      return {
        success: true,
        instance: {
          id: instance.idInstance,
          name: instance.name,
          state: instance.stateInstance,
          createdAt: instance.createdAt,
        },
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
      throw new HttpException('Instance not found or unauthorized', HttpStatus.FORBIDDEN);
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
      throw new HttpException('Instance not found or unauthorized', HttpStatus.FORBIDDEN);
    }

    const updatedInstance = await this.prisma.updateInstanceName(instanceId, dto.name);

    return {
      success: true,
      instance: {
        id: updatedInstance.idInstance,
        name: updatedInstance.name,
        state: updatedInstance.stateInstance,
        createdAt: updatedInstance.createdAt,
      },
    };
  }
}
