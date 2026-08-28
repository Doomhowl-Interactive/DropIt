import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import type { FileStorage, StoredObject, StoredObjectBody } from './storage';

export interface S3StorageOptions {
  bucket: string;
  /** Key prefix, e.g. `uploads/`. Empty means "objects sit at the root". */
  prefix?: string;
  region?: string;
  /** Custom endpoint for non-AWS stores (MinIO, R2, Garage, Backblaze B2). */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /**
   * Path-style addressing (`host/bucket/key`) instead of virtual-hosted
   * (`bucket.host/key`). Most self-hosted S3 clones only speak the former.
   */
  forcePathStyle?: boolean;
}

/** Objects in an S3-compatible bucket. */
export class S3FileStorage implements FileStorage {
  readonly kind = 's3';

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(options: S3StorageOptions, client?: S3Client) {
    this.bucket = options.bucket;
    this.prefix = normalizePrefix(options.prefix);
    this.client = client ?? new S3Client(clientConfig(options));
  }

  locationFor(filename: string): string {
    return this.locationOf(randomUUID() + extname(filename));
  }

  private locationOf(name: string): string {
    return this.prefix + name;
  }

  async write(location: string, bytes: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: location,
        Body: bytes,
        ContentLength: bytes.length,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    );
  }

  /**
   * Multipart upload, because the length of a multer stream is not known up
   * front and S3 refuses a `PutObject` without one.
   */
  async writeStream(location: string, stream: Readable, contentType?: string): Promise<number> {
    let size = 0;
    const counter = new PassThrough();
    counter.on('data', (chunk: Buffer) => (size += chunk.length));

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: location,
        Body: stream.pipe(counter),
        ...(contentType ? { ContentType: contentType } : {}),
      },
    });

    await upload.done();
    return size;
  }

  async read(location: string): Promise<Buffer> {
    const { body } = await this.open(location);
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk as Buffer));
    return Buffer.concat(chunks);
  }

  async open(location: string, range?: string): Promise<StoredObjectBody> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: location,
        ...(range ? { Range: range } : {}),
      }),
    );

    if (!response.Body) throw new Error(`empty response body for ${location}`);

    const size = response.ContentLength ?? 0;

    return {
      body: response.Body as Readable,
      size,
      // `ContentRange` is `bytes a-b/total`; without a range the object size
      // is the total.
      totalSize: totalFromContentRange(response.ContentRange) ?? size,
      ...(response.ContentRange ? { contentRange: response.ContentRange } : {}),
      ...(response.ContentType ? { contentType: response.ContentType } : {}),
      ...(response.LastModified ? { modifiedAt: response.LastModified } : {}),
    };
  }

  /** S3 treats deleting a missing key as a success, which is what we want. */
  async remove(location: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: location }));
  }

  async list(): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let token: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ...(this.prefix ? { Prefix: this.prefix } : {}),
          ...(token ? { ContinuationToken: token } : {}),
        }),
      );

      for (const object of page.Contents ?? []) {
        const key = object.Key;
        // A key ending in `/` is a console-created folder marker, not a file.
        if (!key || key.endsWith('/')) continue;

        objects.push({
          location: key,
          name: key.slice(this.prefix.length),
          size: object.Size ?? 0,
          modifiedAt: object.LastModified ?? new Date(0),
        });
      }

      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return objects;
  }
}

function clientConfig(options: S3StorageOptions): S3ClientConfig {
  return {
    region: options.region || 'us-east-1',
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    // Default to path style whenever a custom endpoint is configured: the
    // self-hosted clones are the ones that need it, real AWS does not.
    forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
    // Without explicit keys the SDK falls back to its own credential chain
    // (instance role, ~/.aws/credentials, AWS_* variables).
    ...(options.accessKeyId && options.secretAccessKey
      ? {
          credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          },
        }
      : {}),
  };
}

/** Pulls `total` out of a `bytes 0-99/1234` content-range header. */
function totalFromContentRange(contentRange: string | undefined): number | undefined {
  const total = Number(contentRange?.split('/')[1]);
  return Number.isFinite(total) ? total : undefined;
}

/** Nothing, or exactly one trailing slash. */
function normalizePrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? '').replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}
