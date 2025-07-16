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
import { EvolutionApiService } from './evolution-api.service';
import { AuthReq, CreateInstanceDto, UpdateInstanceDto } from '../types';
import { GhlContextGuard } from './guards/ghl-context.guard';

@Controller('api/instances')
@UseGuards(GhlContextGuard)
export class EvolutionApiController {
  constructor(
    private readonly logger: Logger,
    private readonly prisma: PrismaService,
    private readonly evolutionApiService: EvolutionApiService,
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
    // El locationId se obtiene del contexto seguro verificado por GhlContextGuard.
    const { locationId } = req;
    this.logger.log(`Executing createInstance for location from context: ${locationId}`);

    // Medida de seguridad: Asegura que el locationId del payload coincida con el del usuario autenticado.
    if (locationId !== dto.locationId) {
        throw new HttpException('Context and payload locationId mismatch. Unauthorized.', HttpStatus.FORBIDDEN);
    }

    // Validación de campos requeridos.
    if (!dto.instanceId || !dto.apiToken) {
        throw new HttpException('Instance ID and API Token are required fields.', HttpStatus.BAD_REQUEST);
    }

    try {
      // La lógica de validación y creación de la instancia ya está en el servicio.
      const instance = await this.evolutionApiService.createEvolutionApiInstanceForUser(
        dto.locationId,
        dto.instanceId,
        dto.apiToken,
        dto.name,
      );

      return { success: true, instance };
    } catch (error) {
      this.logger.error(`Failed to create instance for location ${locationId}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error; // Re-lanza la excepción si ya es de tipo HTTP.
      }
      // Envuelve errores inesperados para una respuesta consistente.
      throw new HttpException('Failed to create instance due to an internal server error.', HttpStatus.INTERNAL_SERVER_ERROR);
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
