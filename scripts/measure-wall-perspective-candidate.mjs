/**
 * PROTOTYPE — 用后即弃。
 *
 * Measure the structural lines that remain after watercolor generation. The
 * control image is the design source; this script reports how closely the
 * raster candidate followed it before the layout is judged.
 */
import sharp from 'sharp'

const sourcePath = process.argv[2]
  ?? 'docs/art/candidates/home-wall-prototype/2026-08-13-right-recede/interior-foreground--right-recede--candidate-v03.png'
const horizonY = 947
const { data, info } = await sharp(sourcePath)
  .flatten({ background: '#f4efdf' })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true })

const luminance = (x, y) => data[y * info.width + x]
const strongestEdgeRow = (x, yFrom, yTo) => {
  let bestY = -1
  let bestGradient = 0
  for (let y = yFrom; y <= yTo; y += 1) {
    const above = (luminance(x, y - 4) + luminance(x, y - 3)) / 2
    const below = (luminance(x, y + 3) + luminance(x, y + 4)) / 2
    const gradient = Math.abs(above - below)
    if (gradient > bestGradient) {
      bestGradient = gradient
      bestY = y
    }
  }
  return bestY
}

const points = []
for (let x = 690; x <= 890; x += 4) {
  const expected = 1280 - (x - 690) * 0.206
  const y = strongestEdgeRow(x, Math.round(expected - 28), Math.round(expected + 28))
  points.push([x, y])
}

const fitLine = (values) => {
  const n = values.length
  const sx = values.reduce((sum, [x]) => sum + x, 0)
  const sy = values.reduce((sum, [, y]) => sum + y, 0)
  const sxx = values.reduce((sum, [x]) => sum + x * x, 0)
  const sxy = values.reduce((sum, [x, y]) => sum + x * y, 0)
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const intercept = (sy - slope * sx) / n
  const rmse = Math.sqrt(values.reduce((sum, [x, y]) => {
    const error = y - (slope * x + intercept)
    return sum + error * error
  }, 0) / n)
  return { slope, intercept, rmse }
}

const first = fitLine(points)
const kept = points.filter(([x, y]) =>
  Math.abs(y - (first.slope * x + first.intercept)) <= Math.max(8, first.rmse),
)
const fit = fitLine(kept)
const vanishingPointX = (horizonY - fit.intercept) / fit.slope
let strongestJamb = { x: -1, score: -1 }
for (let x = 630; x <= 720; x += 1) {
  let score = 0
  for (let y = 100; y <= 1080; y += 4) {
    score += Math.abs(luminance(x + 3, y) - luminance(x - 3, y))
  }
  if (score > strongestJamb.score) strongestJamb = { x, score }
}

console.log(JSON.stringify({
  sourcePath,
  nearJambX: strongestJamb.x,
  floorWallEdge: {
    slope: Number(fit.slope.toFixed(4)),
    degrees: Number(((Math.atan(fit.slope) * 180) / Math.PI).toFixed(1)),
    intercept: Number(fit.intercept.toFixed(1)),
    rmse: Number(fit.rmse.toFixed(2)),
    kept: `${kept.length}/${points.length}`,
    inferredVanishingPointAtHorizon: [
      Math.round(vanishingPointX),
      horizonY,
    ],
  },
}, null, 2))
