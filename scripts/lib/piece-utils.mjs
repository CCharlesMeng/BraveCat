/**
 * HomePiece 装配共享工具：绿幕键控与接触阴影。
 * 供 scripts/build-*-pieces.mjs 系列脚本复用。
 */
import sharp from 'sharp'

/** 绿度优势键控 + 溢色抑制，返回透明 PNG buffer。 */
export const keyedPng = async (sourcePath) => {
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
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer()
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
