/**
 * Compat layer: re-exporta a API de storage local para o restante do código.
 * Trocar de provider (R2, S3, Firebase) significa só apontar essas exports
 * para outro módulo, sem tocar nos consumidores.
 */
export {
  uploadFile,
  uploadBuffer,
  downloadToFile,
  getSignedReadUrl,
  publicUrlForStoragePath,
  healthCheck,
} from "./local";
