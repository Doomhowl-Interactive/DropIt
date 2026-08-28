import { config } from '../config';
import { S3FileStorage } from './s3-storage';
import { LocalFileStorage, type FileStorage } from './storage';

/** Builds the storage backend `STORAGE_DRIVER` asks for (see config.ts). */
export function createFileStorage(): FileStorage {
  if (config.storageDriver !== 's3') {
    return new LocalFileStorage(config.storageDir);
  }

  const s3 = config.s3;
  if (!s3.bucket) {
    throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET to be set');
  }

  return new S3FileStorage(s3);
}
