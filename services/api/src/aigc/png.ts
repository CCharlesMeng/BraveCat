/** 最小 PNG 头解析：供 QA 的格式/尺寸/alpha 检查使用，不做完整解码。 */

export interface PngHeader {
  width: number
  height: number
  bitDepth: number
  colorType: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** truecolor + alpha（RGBA）。 */
export const PNG_COLOR_TYPE_RGBA = 6
/** grayscale + alpha。 */
export const PNG_COLOR_TYPE_GRAY_ALPHA = 4

export const parsePngHeader = (bytes: Uint8Array): PngHeader | undefined => {
  // 签名 8 字节 + IHDR chunk（长度 4 + 类型 4 + 数据 13 + CRC 4）= 33 字节。
  if (bytes.length < 33) {
    return undefined
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return undefined
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13) {
    return undefined
  }
  const chunkType = String.fromCharCode(
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15],
  )
  if (chunkType !== 'IHDR') {
    return undefined
  }
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  }
}

export const pngHasAlpha = (header: PngHeader): boolean =>
  header.colorType === PNG_COLOR_TYPE_RGBA ||
  header.colorType === PNG_COLOR_TYPE_GRAY_ALPHA
