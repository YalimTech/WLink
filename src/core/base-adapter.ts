// src/core/base-adapter.ts

import { MessageTransformer, StorageProvider } from '../evolutionapi'; // Asegúrate de que esta ruta sea correcta

export { StorageProvider }; // <--- ESTA LÍNEA RESUELVE EL ERROR DE EXPORTACIÓN

export abstract class BaseAdapter<T, U, V, W> {
  protected readonly logger;

  constructor(
    protected readonly transformer: MessageTransformer<T, U>,
    protected readonly storage: StorageProvider<V, W, any, any>,
  ) {
    this.logger = (this.constructor as any).logger;
  }
}
