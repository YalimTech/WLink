// src/core/base-adapter.ts

import { MessageTransformer, StorageProvider, NotFoundError, IntegrationError } from '../evolutionapi';

export { MessageTransformer, StorageProvider, NotFoundError, IntegrationError };

export abstract class BaseAdapter<T, U, V, W> {
  protected readonly logger;

  constructor(
    protected readonly transformer: MessageTransformer<T, U>,
    protected readonly storage: StorageProvider<V, W, any, any>,
  ) {
    // Inicializa el logger para que las clases que hereden de esta lo tengan disponible
    this.logger = new (this.constructor as any).logger();
  }
}
