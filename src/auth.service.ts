import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EvolutionService } from './evolution/evolution.service';

@Injectable()
export class AuthService {
  constructor(private readonly evolution: EvolutionService) {}

  async validateInstance(instanceId: string, token: string): Promise<any> {
    try {
      const status = await this.evolution.getInstanceStatus(token);
      // If API provides instance identifier, ensure it matches
      const returnedId = status?.idInstance || status?.instanceId || status?.instance_id;
      if (returnedId && returnedId.toString() !== instanceId.toString()) {
        throw new UnauthorizedException('Instance ID mismatch');
      }
      return status;
    } catch (error: any) {
      throw new UnauthorizedException(error.message || 'Invalid Evolution API credentials');
    }
  }
}
