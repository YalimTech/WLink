import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EvolutionService } from './evolution/evolution.service';

@Injectable()
export class AuthService {
  constructor(private readonly evolution: EvolutionService) {}

  async validateInstance(instanceId: string, token: string): Promise<any> {
    try {
      const status = await this.evolution.getInstanceStatus(token);

      // If API provides instance identifier, ensure it matches
      const returnedId =
        status?.idInstance || status?.instanceId || status?.instance_id;
      if (returnedId && returnedId.toString() !== instanceId.toString()) {
        throw new UnauthorizedException('Instance ID mismatch');
      }

      return status;
    } catch (error: any) {
      // Handle Axios errors (network issues or non-2xx responses)
      if (error?.isAxiosError) {
        if (error.response) {
          const statusCode = error.response.status;
          const message =
            error.response.data?.message || error.response.statusText || '';
          throw new UnauthorizedException(
            `Evolution API responded with status ${statusCode}${
              message ? `: ${message}` : ''
            }`,
          );
        }
        // No response indicates the API couldn't be reached
        throw new UnauthorizedException('Evolution API unreachable');
      }

      // Forward HttpException messages from EvolutionService
      if (error?.message) {
        throw new UnauthorizedException(error.message);
      }

      throw new UnauthorizedException('Invalid Evolution API credentials');
    }
  }
}
