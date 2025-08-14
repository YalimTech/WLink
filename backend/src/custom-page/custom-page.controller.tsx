import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config'; // Importa ConfigService para acceder a variables de entorno
import * as CryptoJS from 'crypto-js'; // Importa CryptoJS para la desencriptación

@Controller('api') // El controlador está mapeado a la ruta base /api
export class CustomPageController {
  constructor(
    private readonly logger: Logger, // Servicio para logging
    private readonly prisma: PrismaService, // Servicio para interactuar con la base de datos
    private readonly configService: ConfigService, // Servicio para acceder a la configuración y variables de entorno
  ) {}

  @Post('decrypt-user-data') // Maneja las peticiones POST a /api/decrypt-user-data
  @HttpCode(HttpStatus.OK) // Devuelve un código de estado 200 OK si todo va bien
  async decryptUserData(
    @Body() body: { encryptedData?: string; context?: string; ghl_context?: string }, // Acepta alias comunes
    @Res() res: Response, // Permite manipular la respuesta HTTP directamente
  ) {
    try {
      // 1. Obtiene la clave secreta de las variables de entorno
      const sharedSecret = this.configService.get<string>('GHL_SHARED_SECRET');
      if (!sharedSecret) {
        this.logger.error('GHL_SHARED_SECRET not configured on the server.');
        throw new UnauthorizedException('Shared secret not configured on the server.');
      }

      // 2. Intenta desencriptar los datos usando la clave secreta
      const encryptedPayload = body.encryptedData || body.context || body.ghl_context;
      if (!encryptedPayload) {
        throw new UnauthorizedException('No encrypted data provided.');
      }
      const decrypted = CryptoJS.AES.decrypt(
        encryptedPayload,
        sharedSecret,
      ).toString(CryptoJS.enc.Utf8);

      // 3. Valida si la desencriptación fue exitosa (no vacía)
      if (!decrypted) {
        this.logger.warn(
          'GHL context decryption failed. Decrypted content is empty. Check your GHL_SHARED_SECRET.',
        );
        throw new UnauthorizedException('Invalid GHL context: decryption failed.');
      }

      // 4. Parsea los datos desencriptados a un objeto JSON
      const userData = JSON.parse(decrypted);
      this.logger.log('Decrypted user data received.');
      const locationId = userData.activeLocation;

      // 5. Valida si se encontró el locationId en los datos desencriptados
      if (!locationId) {
        this.logger.warn({
          message: 'No activeLocation property found in decrypted GHL payload.',
          decryptedPayload: userData,
        });
        throw new UnauthorizedException('No active location ID in user context');
      }

      // 6. Busca el usuario en la base de datos usando el locationId
      const user = await this.prisma.findUser(locationId);
      console.log('User found in DB:', user ? user.locationId : 'None');

      // 7. Envía la respuesta JSON con los datos del usuario
      return res.json({
        success: true,
        locationId,
        userData,
        user: user
          ? { locationId: user.locationId, hasTokens: !!(user.accessToken && user.refreshToken) }
          : null,
      });
    } catch (error) {
      // Manejo de errores: loggea el error y lanza una excepción adecuada
      this.logger.error('Error decrypting user data:', error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or malformed GHL context or internal server error.');
    }
  }
}
