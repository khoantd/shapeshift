import "server-only";

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class MinioConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "MinioConfigError";
  }
}

export const MISSING_MINIO_MESSAGE =
  "MinIO is not configured. Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET.";

type MinioEnv = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  useSsl: boolean;
};

function readMinioEnv(): MinioEnv | null {
  const endpoint = process.env.MINIO_ENDPOINT?.trim();
  const accessKey = process.env.MINIO_ACCESS_KEY?.trim();
  const secretKey = process.env.MINIO_SECRET_KEY?.trim();
  const bucket = process.env.MINIO_BUCKET?.trim();
  if (!endpoint || !accessKey || !secretKey || !bucket) return null;
  const region = process.env.MINIO_REGION?.trim() || "us-east-1";
  const useSsl =
    process.env.MINIO_USE_SSL === "1" ||
    process.env.MINIO_USE_SSL === "true" ||
    endpoint.startsWith("https://");
  return { endpoint, accessKey, secretKey, bucket, region, useSsl };
}

export function hasMinioConfig(): boolean {
  return readMinioEnv() !== null;
}

let cachedClient: S3Client | null = null;
let cachedBucket: string | null = null;
let bucketReady: string | null = null;
let bucketReadyPromise: Promise<void> | null = null;

function getClient(): { client: S3Client; bucket: string } {
  const env = readMinioEnv();
  if (!env) throw new MinioConfigError(MISSING_MINIO_MESSAGE);
  if (!cachedClient || cachedBucket !== env.bucket) {
    const endpointUrl = env.endpoint.includes("://")
      ? env.endpoint
      : `${env.useSsl ? "https" : "http"}://${env.endpoint}`;
    cachedClient = new S3Client({
      endpoint: endpointUrl,
      region: env.region,
      credentials: {
        accessKeyId: env.accessKey,
        secretAccessKey: env.secretKey,
      },
      forcePathStyle: true,
    });
    cachedBucket = env.bucket;
    bucketReady = null;
    bucketReadyPromise = null;
  }
  return { client: cachedClient, bucket: env.bucket };
}

function isNotFoundError(err: unknown): boolean {
  const status =
    err && typeof err === "object" && "$metadata" in err
      ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
      : undefined;
  if (status === 404) return true;
  const name = err instanceof Error ? err.name : "";
  return (
    name === "NotFound" ||
    name === "NoSuchKey" ||
    name === "NoSuchBucket"
  );
}

function isNoSuchBucketError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === "NoSuchBucket" ||
    /specified bucket does not exist/i.test(message) ||
    /NoSuchBucket/i.test(message)
  );
}

/** Ensure configured bucket exists (create if missing). Idempotent. */
async function ensureBucket(): Promise<{ client: S3Client; bucket: string }> {
  const { client, bucket } = getClient();
  if (bucketReady === bucket) return { client, bucket };
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (err) {
        if (!isNotFoundError(err) && !isNoSuchBucketError(err)) {
          throw new MinioConfigError(
            `MinIO bucket check failed for "${bucket}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (createErr) {
          // Race: another process created it
          if (!isNoSuchBucketError(createErr) && !isNotFoundError(createErr)) {
            const msg =
              createErr instanceof Error
                ? createErr.message
                : String(createErr);
            if (!/BucketAlreadyOwnedByYou|BucketAlreadyExists/i.test(msg)) {
              throw new MinioConfigError(
                `MinIO bucket "${bucket}" is missing and could not be created: ${msg}`,
              );
            }
          }
        }
      }
      bucketReady = bucket;
    })().finally(() => {
      if (bucketReady !== bucket) bucketReadyPromise = null;
    });
  }
  await bucketReadyPromise;
  return { client, bucket };
}

function wrapMinioOpError(err: unknown, op: string): never {
  if (err instanceof MinioConfigError) throw err;
  if (isNoSuchBucketError(err)) {
    const bucket = readMinioEnv()?.bucket ?? "(unset)";
    throw new MinioConfigError(
      `MinIO bucket "${bucket}" does not exist. Create it or set MINIO_BUCKET.`,
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  throw new MinioConfigError(`MinIO ${op} failed: ${message}`);
}

export async function putObject(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const { client, bucket } = await ensureBucket();
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  } catch (err) {
    wrapMinioOpError(err, "upload");
  }
}

export type ObjectHeadMeta = {
  exists: boolean;
  contentLength: number | null;
};

export async function headObject(key: string): Promise<ObjectHeadMeta> {
  const { client, bucket } = await ensureBucket();
  try {
    const out = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    const len =
      typeof out.ContentLength === "number" && Number.isFinite(out.ContentLength)
        ? out.ContentLength
        : null;
    return { exists: true, contentLength: len };
  } catch (err) {
    if (isNoSuchBucketError(err)) wrapMinioOpError(err, "lookup");
    if (isNotFoundError(err)) return { exists: false, contentLength: null };
    const name = err instanceof Error ? err.name : "";
    if (name === "NotFound" || name === "NoSuchKey") {
      return { exists: false, contentLength: null };
    }
    wrapMinioOpError(err, "lookup");
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const meta = await headObject(key);
  return meta.exists;
}

export async function getSignedObjectUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { client, bucket } = await ensureBucket();
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  } catch (err) {
    wrapMinioOpError(err, "sign");
  }
}

export type GetObjectResult = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  contentLength: number | null;
  contentRange: string | null;
  etag: string | null;
  statusCode: number;
};

export class MinioObjectNotFoundError extends Error {
  readonly status = 404;
  constructor(key: string) {
    super(`Object not found: ${key}`);
    this.name = "MinioObjectNotFoundError";
  }
}

/** Stream an object (optional HTTP Range) for same-origin media proxy. */
export async function getObject(input: {
  key: string;
  range?: string;
}): Promise<GetObjectResult> {
  const { client, bucket } = await ensureBucket();
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ...(input.range ? { Range: input.range } : {}),
      }),
    );
    const body = out.Body
      ? (out.Body.transformToWebStream() as ReadableStream<Uint8Array>)
      : null;
    return {
      body,
      contentType: out.ContentType || "application/octet-stream",
      contentLength:
        typeof out.ContentLength === "number" ? out.ContentLength : null,
      contentRange: out.ContentRange ?? null,
      etag: out.ETag ?? null,
      statusCode: input.range ? 206 : 200,
    };
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new MinioObjectNotFoundError(input.key);
    }
    wrapMinioOpError(err, "download");
  }
}

/** Download an object fully into a Buffer (e.g. measure MP3 duration on resume). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const { client, bucket } = await ensureBucket();
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!out.Body) {
      throw new MinioObjectNotFoundError(key);
    }
    const bytes = await out.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    if (err instanceof MinioObjectNotFoundError) throw err;
    if (isNotFoundError(err)) {
      throw new MinioObjectNotFoundError(key);
    }
    wrapMinioOpError(err, "download");
  }
}
