import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { AssetStorage } from '../ports.js'

/**
 * S3 兼容对象存储 adapter：阿里云 OSS 以 S3 兼容模式接入，
 * 换云（MinIO/AWS/腾讯 COS）为配置级变更。未与真实服务联调。
 */

export interface S3AssetStorageConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** OSS 用 virtual-hosted style（false）；MinIO 等自建通常需要 path style（true）。 */
  forcePathStyle?: boolean
}

export const createS3AssetStorageFromEnv = (
  env: NodeJS.ProcessEnv,
): AssetStorage | undefined => {
  const endpoint = env.ASSET_STORAGE_ENDPOINT
  const region = env.ASSET_STORAGE_REGION
  const bucket = env.ASSET_STORAGE_BUCKET
  const accessKeyId = env.ASSET_STORAGE_ACCESS_KEY_ID
  const secretAccessKey = env.ASSET_STORAGE_SECRET_ACCESS_KEY
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    return undefined
  }
  return createS3AssetStorage({
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: env.ASSET_STORAGE_FORCE_PATH_STYLE === 'true',
  })
}

const isNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  ((error as { name: string }).name === 'NotFound' ||
    (error as { name: string }).name === 'NoSuchKey')

export const createS3AssetStorage = (
  config: S3AssetStorageConfig,
): AssetStorage => {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? false,
  })

  return {
    put: async (key, bytes, contentType) => {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      )
    },
    get: async (key) => {
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        )
        return response.Body
          ? await response.Body.transformToByteArray()
          : undefined
      } catch (error) {
        if (isNotFoundError(error)) {
          return undefined
        }
        throw error
      }
    },
    exists: async (key) => {
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
        )
        return true
      } catch (error) {
        if (isNotFoundError(error)) {
          return false
        }
        throw error
      }
    },
  }
}
