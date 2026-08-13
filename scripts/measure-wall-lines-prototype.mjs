/**
 * PROTOTYPE — 用后即弃。
 * 从 Home v4 底图实测墙面横线斜率：右墙地脚线、柜面（边桌顶面）前后沿，
 * 以及窗墙地脚线（应≈0°，作为方法对照）。逐列在窗口内找特征行，
 * 最小二乘拟合；标注图用直接写像素生成，避免 SVG DPI 缩放问题。
 */
import sharp from 'sharp'

const SRC = 'apps/web/public/dev-art/home-v4/interior-foreground.png'

const { data, info } = await sharp(SRC)
  .flatten({ background: '#f4efdc' })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true })

const lum = (x, y) => data[y * info.width + x]

const darkestRow = (x, yFrom, yTo) => {
  let bestY = -1
  let bestV = 256
  for (let y = yFrom; y <= yTo; y += 1) {
    const v = (lum(x, y - 1) + lum(x, y) + lum(x, y + 1)) / 3
    if (v < bestV) {
      bestV = v
      bestY = y
    }
  }
  return { y: bestY, v: bestV }
}

const strongestEdgeRow = (x, yFrom, yTo) => {
  let bestY = -1
  let bestG = 0
  for (let y = yFrom; y <= yTo; y += 1) {
    const above = (lum(x, y - 3) + lum(x, y - 2)) / 2
    const below = (lum(x, y + 2) + lum(x, y + 3)) / 2
    const g = above - below
    if (g > bestG) {
      bestG = g
      bestY = y
    }
  }
  return { y: bestY, g: bestG }
}

const fitLine = (points) => {
  const n = points.length
  const sx = points.reduce((s, [x]) => s + x, 0)
  const sy = points.reduce((s, [, y]) => s + y, 0)
  const sxx = points.reduce((s, [x]) => s + x * x, 0)
  const sxy = points.reduce((s, [x, y]) => s + x * y, 0)
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const intercept = (sy - slope * sx) / n
  const rmse = Math.sqrt(points.reduce((s, [x, y]) => {
    const e = y - (slope * x + intercept)
    return s + e * e
  }, 0) / n)
  return { slope, intercept, rmse }
}

const degrees = (slope) => (Math.atan(slope) * 180) / Math.PI

/** 中位数滤波剔除离群点后再拟合。 */
const robustFit = (name, rawPoints) => {
  const first = fitLine(rawPoints)
  const kept = rawPoints.filter(([x, y]) =>
    Math.abs(y - (first.slope * x + first.intercept)) <= Math.max(6, first.rmse),
  )
  const fit = fitLine(kept)
  console.log(
    `${name}: slope=${fit.slope.toFixed(4)} (${degrees(fit.slope).toFixed(1)}°)`
    + ` intercept=${fit.intercept.toFixed(1)}`
    + ` rmse=${fit.rmse.toFixed(2)} kept=${kept.length}/${rawPoints.length}`,
  )
  return { name, ...fit, points: kept }
}

const collect = (xRanges, step, finder) => {
  const points = []
  for (const [from, to, yFrom, yTo] of xRanges) {
    for (let x = from; x <= to; x += step) {
      const { y } = finder(x, yFrom, yTo)
      if (y > 0) points.push([x, y])
    }
  }
  return points
}

const results = [
  // 窗墙地脚线（方法对照，应≈0°）：踢脚板上沿亮→暗边。
  robustFit('窗墙·踢脚板上沿(对照)', collect(
    [[600, 755, 1100, 1200]], 4, strongestEdgeRow,
  )),
  // 右墙地脚线：踢脚板上沿。桌腿在 x≈915 之后，窗口按目检收紧。
  robustFit('右墙·踢脚板上沿', collect(
    [[778, 910, 1110, 1230]], 3, strongestEdgeRow,
  )),
  // 右墙地脚线：踢脚板与地板交线（暗描边谷）。
  robustFit('右墙·踢脚板下沿', collect(
    [[778, 910, 1150, 1270]], 3, darkestRow,
  )),
  // 柜面后沿（贴墙一侧的暗描边），避开花瓶 x≈1040..1150。
  robustFit('柜面·后沿', collect(
    [[952, 1032, 935, 985], [1152, 1192, 925, 985]], 3, darkestRow,
  )),
  // 柜面前沿（外侧粗描边）。
  robustFit('柜面·前沿', collect(
    [[952, 1032, 988, 1042], [1152, 1192, 980, 1042]], 3, darkestRow,
  )),
]

// --- 灭点交汇检验：右墙各线两两求交 ---
const intersect = (a, b) => {
  const x = (b.intercept - a.intercept) / (a.slope - b.slope)
  return [Math.round(x), Math.round(a.slope * x + a.intercept)]
}
const [windowSkirt, rightSkirtTop, rightSkirtBottom, cabRear, cabFront] = results
console.log('右墙线交点(候选灭点):')
console.log('  踢脚上沿 × 柜面后沿:', intersect(rightSkirtTop, cabRear))
console.log('  踢脚上沿 × 柜面前沿:', intersect(rightSkirtTop, cabFront))
console.log('  踢脚下沿 × 柜面后沿:', intersect(rightSkirtBottom, cabRear))
console.log('  踢脚下沿 × 柜面前沿:', intersect(rightSkirtBottom, cabFront))
console.log('  柜面后沿 × 柜面前沿:', intersect(cabRear, cabFront))
console.log('窗墙踢脚线在候选水平线高度处的位置(应为右侧灭点):')
const vp = intersect(rightSkirtTop, cabRear)
console.log('  窗墙线到达 y=' + vp[1] + ' 时 x =',
  Math.round((vp[1] - windowSkirt.intercept) / windowSkirt.slope))

// --- 直接写像素生成标注图（无 SVG）---
const rgba = await sharp(SRC)
  .flatten({ background: '#f4efdc' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const px = rgba.data
const W = rgba.info.width
const H = rgba.info.height
const setPx = (x, y, [r, g, b]) => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return
  const i = (yi * W + xi) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = 255
}
const colors = [
  [214, 58, 142],
  [43, 123, 214],
  [37, 160, 90],
  [224, 123, 40],
  [140, 60, 200],
]
results.forEach(({ slope, intercept, points }, index) => {
  const color = colors[index]
  const xs = points.map(([x]) => x)
  const from = Math.min(...xs) - 30
  const to = Math.max(...xs) + 30
  for (let x = from; x <= to; x += 1) {
    if (x % 8 < 5) {
      const y = slope * x + intercept
      setPx(x, y - 1, color)
      setPx(x, y, color)
    }
  }
  for (const [x, y] of points) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) setPx(x + dx, y + dy, color)
    }
  }
})

await sharp(px, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: 560, top: 880, width: 640, height: 420 })
  .resize(1280, null, { kernel: 'nearest' })
  .png()
  .toFile('/tmp/wall-lines-measured-v2.png')
console.log('annotated: /tmp/wall-lines-measured-v2.png')
