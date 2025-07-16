// src/core/base-adapter.ts

import { Logger } from '@nestjs/common';
import { MessageTransformer, StorageProvider, NotFoundError, IntegrationError } from '../evolutionapi';

export { MessageTransformer, StorageProvider, NotFoundError, IntegrationError };

export abstract class BaseAdapter<T, U, V, W> {
  // El logger se declara aquí pero se inicializa en el constructor.
  protected readonly logger: Logger;

  constructor(
    protected readonly transformer: MessageTransformer<T, U>,
    protected readonly storage: StorageProvider<V, W, any, any>,
  ) {
    // Inicializa el logger usando el nombre de la clase que lo extiende (ej. GhlService).
    // Esto resuelve la necesidad de pasar el logger en el super().
    this.logger = new Logger(this.constructor.name);
  }
}
