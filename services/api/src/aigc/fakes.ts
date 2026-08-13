import { deflateSync } from 'node:zlib'
import { parsePngHeader } from './png.js'
import type {
  AssetStorage,
  GenerationProvider,
  ModerationInput,
  ModerationProvider,
  ModerationVerdict,
  PurchaseVerifier,
} from './ports.js'

/**
 * 测试与本地开发用的 provider 实现：不出网、确定性、与生产管线同构。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  chunk.write(type, 4, 'ascii')
  chunk.set(data, 8)
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length)
  return chunk
}

const encodedPngCache = new Map<string, Uint8Array>()

/** 生成可真实解码的纯色 PNG（fake 生成器与测试用）；按尺寸/通道 memoize。 */
export const encodeSolidPng = (
  width: number,
  height: number,
  options: { alpha: boolean },
): Uint8Array => {
  const cacheKey = `${width}x${height}:${options.alpha}`
  const cached = encodedPngCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const channels = options.alpha ? 4 : 3
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // bit depth
  ihdr.writeUInt8(options.alpha ? 6 : 2, 9) // color type: RGBA / RGB
  // compression / filter / interlace 均为 0。

  // 每行首字节为 filter=0，像素填充白色（alpha 版为不透明白）。
  const raw = Buffer.alloc(height * (1 + width * channels), 0xff)
  for (let y = 0; y < height; y += 1) {
    raw[y * (1 + width * channels)] = 0
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
  const bytes = new Uint8Array(png)
  encodedPngCache.set(cacheKey, bytes)
  return bytes
}

/** 假审核：默认全部通过；可注入判定函数模拟拒绝。 */
export const createFakeModerationProvider = (
  decide?: (input: ModerationInput) => ModerationVerdict,
): ModerationProvider => ({
  moderateImage: async (input) => decide?.(input) ?? { verdict: 'pass' },
})

/**
 * 假生成器：与生产管线同构（风格化 → 逐姿势白底 RGB 出图 → 抠图后处理补 alpha），
 * 产出符合现役资产规格的占位 PNG。
 */
export const createFakeGenerationProvider = (
  options: {
    /** 覆盖逐姿势出图，用于模拟规格不合规等 QA 失败场景。 */
    generatePose?: (pose: string) => Uint8Array
  } = {},
): GenerationProvider => ({
  stylize: async ({ photo }) => ({
    featureLock: '占位特征锁定文字（花色分块/眼色/体型）',
    referenceImage: photo,
  }),
  generatePose: async ({ pose }) =>
    options.generatePose?.(pose) ?? encodeSolidPng(1024, 1024, { alpha: false }),
  removeBackground: async ({ image }) => {
    const header = parsePngHeader(image)
    if (!header) {
      // 无法解析时原样返回，交给 QA 判失败。
      return image
    }
    return encodeSolidPng(header.width, header.height, { alpha: true })
  },
})

/** 内存对象存储：单测与本地无云开发用。 */
export const createMemoryAssetStorage = (): AssetStorage => {
  const objects = new Map<string, Uint8Array>()
  return {
    put: async (key, bytes, _contentType) => {
      objects.set(key, bytes)
    },
    get: async (key) => objects.get(key),
    exists: async (key) => objects.has(key),
  }
}

/**
 * 测试用购买核销 stub：只接受 `test:<orderId>:<credits>` 格式凭证。
 * 生产核销（Apple StoreKit Server API / 微信支付）在 Phase 2/4 以同一端口接入，
 * 生产入口在接入前注入 unavailable 实现（见 src/aigc/unavailable.ts）。
 */
export const createStubPurchaseVerifier = (): PurchaseVerifier => ({
  verify: async ({ receipt }) => {
    const match = /^test:([A-Za-z0-9_-]+):([0-9]+)$/.exec(receipt)
    const credits = match ? Number(match[2]) : 0
    if (!match || credits < 1) {
      return {
        ok: false,
        code: 'invalid_receipt',
        message: '凭证核销失败（测试核销器只接受 test:<orderId>:<credits>）',
      }
    }
    return { ok: true, orderId: match[1], credits }
  },
})
