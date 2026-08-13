/**
 * HomePiece 装配共享工具：绿幕键控、洞检测、接触阴影与
 * 几何/外壳版本解析。供 scripts/build-*-pieces.mjs 系列脚本复用。
 */
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/** 绿度优势键控 + 溢色抑制，返回 raw RGBA {data,width,height}。 */
export const keyedRaw = async (sourcePath) => {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true })
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const greenness = green - Math.max(red, blue)
    if (greenness >= 70) {
      data[offset + 3] = 0
    } else if (greenness > 30) {
      data[offset + 3] = Math.round(255 * (1 - (greenness - 30) / 40))
    }
    if (data[offset + 3] > 0) {
      data[offset + 1] = Math.min(green, Math.round(Math.max(red, blue) * 1.15))
    }
  }
  return { data, width: info.width, height: info.height }
}

/** 绿度优势键控 + 溢色抑制，返回透明 PNG buffer。 */
export const keyedPng = async (sourcePath) => {
  const { data, width, height } = await keyedRaw(sourcePath)
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

/** 找包含中心的透明洞：多行/多列取最宽 alpha=0 连续段。 */
export const detectHole = (src) => {
  const alphaAt = (x, y) => src.data[(y * src.width + x) * 4 + 3]
  const spanContaining = (values, isClear, center) => {
    if (!isClear(center)) return null
    let low = center
    let high = center
    while (low > 0 && isClear(low - 1)) low -= 1
    while (high < values - 1 && isClear(high + 1)) high += 1
    return { low, high }
  }
  let left = Infinity
  let right = -Infinity
  for (const fraction of [0.4, 0.45, 0.5, 0.55, 0.6]) {
    const y = Math.round(src.height * fraction)
    const span = spanContaining(
      src.width, (x) => alphaAt(x, y) === 0, Math.round(src.width / 2),
    )
    if (span) {
      left = Math.min(left, span.low)
      right = Math.max(right, span.high)
    }
  }
  let top = Infinity
  let bottom = -Infinity
  for (const fraction of [0.42, 0.5, 0.58]) {
    const x = Math.round(left + (right - left) * fraction)
    const span = spanContaining(
      src.height, (y) => alphaAt(x, y) === 0, Math.round(src.height / 2),
    )
    if (span) {
      top = Math.min(top, span.low)
      bottom = Math.max(bottom, span.high)
    }
  }
  return { left, right, top, bottom }
}

/** 读取 form 几何：优先 v03（F 正窗重冻结），回退 v02。 */
export const loadGeometry = async (productionRoot, slug) => {
  for (const version of ['v03', 'v02']) {
    const file = path.join(productionRoot, slug, `geometry--measured-freeze-${version}.json`)
    try {
      await access(file)
      return JSON.parse(await readFile(file, 'utf8'))
    } catch {
      // 尝试下一版本。
    }
  }
  throw new Error(`no frozen geometry for ${slug}`)
}

/** 解析 clean shell 路径：优先 v02（F 正窗重制），回退 v01。 */
export const resolveShell = async (productionRoot, slug) => {
  for (const version of ['v02', 'v01']) {
    const file = path.join(productionRoot, slug, `shell--aperture-alpha--candidate-${version}.png`)
    try {
      await access(file)
      return file
    } catch {
      // 尝试下一版本。
    }
  }
  throw new Error(`no shell for ${slug}`)
}

/**
 * 接触阴影：径向渐变软椭圆（librsvg 不依赖 filter，渐变最稳）。
 * 返回可直接 composite 的整幅 SVG buffer。
 */
export const contactShadowSvg = ({
  canvasWidth, canvasHeight, cx, cy, rx, ry, opacity = 0.26, color = '#33281c',
}) => Buffer.from(`
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${opacity}"/>
      <stop offset="60%" stop-color="${color}" stop-opacity="${(opacity * 0.55).toFixed(3)}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#shadow)"/>
</svg>
`)
