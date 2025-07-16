// src/core/base-adapter.ts

import { MessageTransformer, StorageProvider, NotFoundError, IntegrationError } from '../evolutionapi'; // Asegúrate de que la ruta a evolutionapi sea correcta

export { MessageTransformer, StorageProvider, NotFoundError, IntegrationError };

export abstract class BaseAdapter<T, U, V, W> {
  protected readonly logger;

  constructor(
    protected readonly transformer: MessageTransformer<T, U>,
    protected readonly storage: StorageProvider<V, W, any, any>,
  ) {
    this.logger = (this.constructor as any).logger;
  }
}
