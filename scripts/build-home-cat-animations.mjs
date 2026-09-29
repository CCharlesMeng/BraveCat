/**
 * Builds pixel-registered Home cat animations from the approved eight-frame v02
 * sheets. The output is an animated WebP whose every page is the same 512px
 * canvas, so responsive rendering never depends on background-position rounding.
 */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.join(
  root,
  'apps/web/public/dev-art/home-v4/cat-animations',
)
const candidateRoot = path.join(
  root,
  'docs/art/candidates/home-v4/cat-animations-v03',
)
const shouldIntegrate = process.argv.includes('--integrate')

const CELL_SIZE = 512
const SOURCE_FRAME_COUNT = 8
const INTERPOLATION_STEPS = 8
const MOTION_FRAME_COUNT = SOURCE_FRAME_COUNT * INTERPOLATION_STEPS
const SLEEP_FRAME_COUNT = 128
const ALPHA_THRESHOLD = 32
const GROUND_BAND_HEIGHT = 24
const INTERPOLATION_BACKGROUND = [248, 243, 231]
const SLEEP_BELLY = { x: 340, y: 295, rx: 108, ry: 76 }

const activities = [
  {
    id: 'sleep',
    durationMs: 5600,
    frameCount: SLEEP_FRAME_COUNT,
    mechanics: 'belly-only-breath',
  },
  { id: 'play', durationMs: 1400, frameCount: MOTION_FRAME_COUNT },
  { id: 'eat', durationMs: 1800, frameCount: MOTION_FRAME_COUNT },
  {
    id: 'gaze',
    frameCount: MOTION_FRAME_COUNT,
    delays: [
      2600,
      ...distributeDelay(1700, MOTION_FRAME_COUNT - 2),
      700,
    ],
  },
]

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

function distributeDelay(totalMs, frameCount) {
  const base = Math.floor(totalMs / frameCount)
  const remainder = totalMs - base * frameCount
  return Array.from(
    { length: frameCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
}

function frameName(activity, kind = 'animation') {
  const suffix = kind === 'poster' ? '--poster' : ''
  return `cat--minho--${activity}--ambient${suffix}--v03.webp`
}

function sourceName(activity) {
  return `cat--minho--${activity}--ambient--v02.webp`
}

function extractFrames(sheet, sheetWidth) {
  return Array.from({ length: SOURCE_FRAME_COUNT }, (_, frameIndex) => {
    const frame = Buffer.alloc(CELL_SIZE * CELL_SIZE * 4)
    for (let y = 0; y < CELL_SIZE; y += 1) {
      const sourceStart = (y * sheetWidth + frameIndex * CELL_SIZE) * 4
      const targetStart = y * CELL_SIZE * 4
      sheet.copy(
        frame,
        targetStart,
        sourceStart,
        sourceStart + CELL_SIZE * 4,
      )
    }
    return frame
  })
}

function measureGroundAnchor(frame) {
  let bottom = -1
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const alpha = frame[(y * CELL_SIZE + x) * 4 + 3]
      if (alpha > ALPHA_THRESHOLD) bottom = y
    }
  }
  if (bottom < 0) throw new Error('Home cat frame is empty')

  let alphaTotal = 0
  let weightedX = 0
  let weightedY = 0
  const startY = Math.max(0, bottom - GROUND_BAND_HEIGHT + 1)
  for (let y = startY; y <= bottom; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const alpha = frame[(y * CELL_SIZE + x) * 4 + 3]
      if (alpha <= ALPHA_THRESHOLD) continue
      alphaTotal += alpha
      weightedX += x * alpha
      weightedY += y * alpha
    }
  }

  return {
    bottom,
    x: weightedX / alphaTotal,
    y: weightedY / alphaTotal,
  }
}

function translateFrame(frame, dx, dy) {
  const translated = Buffer.alloc(frame.length)
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const sourceOffset = (y * CELL_SIZE + x) * 4
      const targetX = x + dx
      const targetY = y + dy
      if (
        targetX < 0
        || targetX >= CELL_SIZE
        || targetY < 0
        || targetY >= CELL_SIZE
      ) {
        if (frame[sourceOffset + 3] > 0) {
          throw new Error(`Pixel registration clips content at ${x},${y}`)
        }
        continue
      }
      const targetOffset = (targetY * CELL_SIZE + targetX) * 4
      frame.copy(translated, targetOffset, sourceOffset, sourceOffset + 4)
    }
  }
  return translated
}

function registerFrames(frames) {
  const sourceAnchors = frames.map(measureGroundAnchor)
  const target = {
    bottom: sourceAnchors[0].bottom,
    x: Math.round(sourceAnchors[0].x),
  }
  const shifts = sourceAnchors.map((anchor) => ({
    dx: target.x - Math.round(anchor.x),
    dy: target.bottom - anchor.bottom,
  }))
  const registered = frames.map((frame, index) => (
    translateFrame(frame, shifts[index].dx, shifts[index].dy)
  ))
  const registeredAnchors = registered.map(measureGroundAnchor)

  for (const anchor of registeredAnchors) {
    if (
      anchor.bottom !== target.bottom
      || Math.round(anchor.x) !== target.x
    ) {
      throw new Error('Registered Home cat keyframe moved off its pixel anchor')
    }
  }

  return {
    frames: registered,
    sourceAnchors,
    registeredAnchors,
    shifts,
    target,
  }
}

async function runMotionInterpolation(frames) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not provide an executable')
  }
  const input = Buffer.concat([
    ...frames,
    frames[0],
    frames[1],
  ])
  const child = spawn(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pixel_format',
    'rgb24',
    '-video_size',
    `${CELL_SIZE}x${CELL_SIZE}`,
    '-framerate',
    String(SOURCE_FRAME_COUNT),
    '-i',
    'pipe:0',
    '-vf',
    [
      `minterpolate=fps=${MOTION_FRAME_COUNT}`,
      'mi_mode=mci',
      'mc_mode=aobmc',
      'me_mode=bidir',
      'me=epzs',
      'mb_size=16',
      'search_param=32',
      'vsbmc=1',
    ].join(':'),
    '-frames:v',
    String(MOTION_FRAME_COUNT),
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    'pipe:1',
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const outputChunks = []
  const errorChunks = []
  child.stdout.on('data', (chunk) => outputChunks.push(chunk))
  child.stderr.on('data', (chunk) => errorChunks.push(chunk))
  child.stdin.end(input)
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  if (exitCode !== 0) {
    throw new Error(
      `Motion interpolation failed (${exitCode}): `
      + Buffer.concat(errorChunks).toString('utf8'),
    )
  }
  return Buffer.concat(outputChunks)
}

async function interpolateFrames(frames, options = {}) {
  const pixelCount = CELL_SIZE * CELL_SIZE
  const rgbFrames = []
  const alphaFrames = []
  for (const frame of frames) {
    const rgb = Buffer.alloc(pixelCount * 3)
    const alpha = Buffer.alloc(pixelCount * 3)
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const sourceOffset = pixel * 4
      const targetOffset = pixel * 3
      const opacity = frame[sourceOffset + 3] / 255
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[targetOffset + channel] = Math.round(
          frame[sourceOffset + channel] * opacity
          + INTERPOLATION_BACKGROUND[channel] * (1 - opacity),
        )
        alpha[targetOffset + channel] = frame[sourceOffset + 3]
      }
    }
    rgbFrames.push(rgb)
    alphaFrames.push(alpha)
  }

  const [rgbOutput, alphaOutput] = await Promise.all([
    runMotionInterpolation(rgbFrames),
    runMotionInterpolation(alphaFrames),
  ])
  const frameBytes = pixelCount * 4
  const output = Array.from(
    { length: MOTION_FRAME_COUNT },
    () => Buffer.alloc(frameBytes),
  )
  for (let frameIndex = 0; frameIndex < MOTION_FRAME_COUNT; frameIndex += 1) {
    const frame = output[frameIndex]
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const rgbaOffset = pixel * 4
      const motionOffset = (frameIndex * pixelCount + pixel) * 3
      const alpha = alphaOutput[motionOffset] / 255
      frame[rgbaOffset + 3] = Math.round(alpha * 255)
      if (alpha < 0.01) continue
      for (let channel = 0; channel < 3; channel += 1) {
        const straightColour = (
          rgbOutput[motionOffset + channel]
          - INTERPOLATION_BACKGROUND[channel] * (1 - alpha)
        ) / alpha
        frame[rgbaOffset + channel] = Math.round(
          Math.max(0, Math.min(255, straightColour)),
        )
      }
    }
  }

  // FFmpeg passes source timestamps through, but replacing these pages makes the
  // identity frames byte-exact and keeps their integer anchors authoritative.
  for (let index = 0; index < frames.length; index += 1) {
    output[index * INTERPOLATION_STEPS] = Buffer.from(frames[index])
  }
  if (options.lockedBodyStartY !== undefined) {
    const lockedBodyStart = options.lockedBodyStartY * CELL_SIZE * 4
    const lockedBody = frames[0].subarray(lockedBodyStart)
    for (const frame of output) {
      lockedBody.copy(frame, lockedBodyStart)
    }
  }
  return output
}

function samplePremultiplied(frame, x, y, target, targetOffset) {
  const x0 = Math.max(0, Math.min(CELL_SIZE - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(CELL_SIZE - 1, Math.floor(y)))
  const x1 = Math.min(CELL_SIZE - 1, x0 + 1)
  const y1 = Math.min(CELL_SIZE - 1, y0 + 1)
  const xRatio = x - Math.floor(x)
  const yRatio = y - Math.floor(y)
  const samples = [
    [x0, y0, (1 - xRatio) * (1 - yRatio)],
    [x1, y0, xRatio * (1 - yRatio)],
    [x0, y1, (1 - xRatio) * yRatio],
    [x1, y1, xRatio * yRatio],
  ]
  let alpha = 0
  const premultiplied = [0, 0, 0]
  for (const [sampleX, sampleY, weight] of samples) {
    const offset = (sampleY * CELL_SIZE + sampleX) * 4
    const sampleAlpha = frame[offset + 3]
    alpha += sampleAlpha * weight
    for (let channel = 0; channel < 3; channel += 1) {
      premultiplied[channel] += (
        frame[offset + channel] * sampleAlpha * weight
      )
    }
  }
  target[targetOffset + 3] = Math.round(alpha)
  if (alpha === 0) {
    target.fill(0, targetOffset, targetOffset + 3)
    return
  }
  for (let channel = 0; channel < 3; channel += 1) {
    target[targetOffset + channel] = Math.round(
      premultiplied[channel] / alpha,
    )
  }
}

function buildSleepFrames(baseFrame) {
  const frames = []
  const minX = Math.floor(SLEEP_BELLY.x - SLEEP_BELLY.rx)
  const maxX = Math.ceil(SLEEP_BELLY.x + SLEEP_BELLY.rx)
  const minY = Math.floor(SLEEP_BELLY.y - SLEEP_BELLY.ry)
  const maxY = Math.ceil(SLEEP_BELLY.y + SLEEP_BELLY.ry)
  for (let frameIndex = 0; frameIndex < SLEEP_FRAME_COUNT; frameIndex += 1) {
    const frame = Buffer.from(baseFrame)
    if (frameIndex === 0) {
      frames.push(frame)
      continue
    }
    const phase = (frameIndex / SLEEP_FRAME_COUNT) * Math.PI * 2
    const fullness = (1 - Math.cos(phase)) / 2
    const horizontalScale = 0.012 * fullness
    const verticalScale = 0.026 * fullness
    const verticalLag = Math.sin(phase) * 0.35
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const normalizedX = (x - SLEEP_BELLY.x) / SLEEP_BELLY.rx
        const normalizedY = (y - SLEEP_BELLY.y) / SLEEP_BELLY.ry
        const radiusSquared = normalizedX ** 2 + normalizedY ** 2
        if (radiusSquared >= 1) continue
        const featherProgress = Math.max(
          0,
          Math.min(1, (radiusSquared - 0.55) / 0.45),
        )
        const feather = 1 - (
          featherProgress ** 2 * (3 - 2 * featherProgress)
        )
        const sourceX = SLEEP_BELLY.x + (
          (x - SLEEP_BELLY.x) / (1 + horizontalScale * feather)
        )
        const sourceY = SLEEP_BELLY.y + (
          (y - SLEEP_BELLY.y - verticalLag * feather)
          / (1 + verticalScale * feather)
        )
        samplePremultiplied(
          baseFrame,
          sourceX,
          sourceY,
          frame,
          (y * CELL_SIZE + x) * 4,
        )
      }
    }
    frames.push(frame)
  }
  return frames
}

function meanFrameDelta(left, right) {
  let total = 0
  const background = [248, 243, 231]
  for (let offset = 0; offset < left.length; offset += 4) {
    const leftAlpha = left[offset + 3] / 255
    const rightAlpha = right[offset + 3] / 255
    for (let channel = 0; channel < 3; channel += 1) {
      const leftVisible = (
        left[offset + channel] * leftAlpha
        + background[channel] * (1 - leftAlpha)
      )
      const rightVisible = (
        right[offset + channel] * rightAlpha
        + background[channel] * (1 - rightAlpha)
      )
      total += Math.abs(leftVisible - rightVisible)
    }
  }
  return total / (left.length / 4 * 3)
}

function loopDeltas(frames) {
  return frames.map((frame, index) => (
    meanFrameDelta(frame, frames[(index + 1) % frames.length])
  ))
}

async function makeContactSheet(rows) {
  const thumbSize = 128
  const composites = []
  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column < SOURCE_FRAME_COUNT; column += 1) {
      const input = await sharp(rows[row].frames[column], {
        raw: {
          width: CELL_SIZE,
          height: CELL_SIZE,
          channels: 4,
        },
      }).resize(thumbSize, thumbSize).png().toBuffer()
      composites.push({
        input,
        left: column * thumbSize,
        top: row * thumbSize,
      })
    }
  }

  await sharp({
    create: {
      width: SOURCE_FRAME_COUNT * thumbSize,
      height: rows.length * thumbSize,
      channels: 4,
      background: '#f8f3e7',
    },
  }).composite(composites).png().toFile(
    path.join(candidateRoot, 'contact-sheet.png'),
  )
}

async function makeMotionContactSheet(rows) {
  const thumbSize = 96
  const sampledFrameCount = 16
  const composites = []
  for (let row = 0; row < rows.length; row += 1) {
    const sampleStep = rows[row].motionFrames.length / sampledFrameCount
    for (let column = 0; column < sampledFrameCount; column += 1) {
      const input = await sharp(rows[row].motionFrames[column * sampleStep], {
        raw: {
          width: CELL_SIZE,
          height: CELL_SIZE,
          channels: 4,
        },
      }).resize(thumbSize, thumbSize).png().toBuffer()
      composites.push({
        input,
        left: column * thumbSize,
        top: row * thumbSize,
      })
    }
  }

  await sharp({
    create: {
      width: sampledFrameCount * thumbSize,
      height: rows.length * thumbSize,
      channels: 4,
      background: '#f8f3e7',
    },
  }).composite(composites).png().toFile(
    path.join(candidateRoot, 'motion-contact-sheet.png'),
  )
}

await mkdir(candidateRoot, { recursive: true })
if (shouldIntegrate) await mkdir(runtimeRoot, { recursive: true })

const manifestRows = []
const contactSheetRows = []

for (const activity of activities) {
  const sourcePath = path.join(runtimeRoot, sourceName(activity.id))
  const sourceContents = await readFile(sourcePath)
  const sourceMetadata = await sharp(sourceContents).metadata()
  if (
    sourceMetadata.width !== CELL_SIZE * SOURCE_FRAME_COUNT
    || sourceMetadata.height !== CELL_SIZE
    || sourceMetadata.hasAlpha !== true
  ) {
    throw new Error(`${sourcePath} is not an eight-frame 512px alpha sheet`)
  }

  const { data: sheet, info } = await sharp(sourceContents)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const sourceFrames = extractFrames(sheet, info.width)
  const registration = registerFrames(sourceFrames)
  const animationFrames = activity.id === 'sleep'
    ? buildSleepFrames(registration.frames[0])
    : await interpolateFrames(
      registration.frames,
      activity.id === 'gaze' ? { lockedBodyStartY: 170 } : undefined,
    )
  const delays = activity.delays
    ?? distributeDelay(activity.durationMs, activity.frameCount)
  if (
    animationFrames.length !== activity.frameCount
    || delays.length !== activity.frameCount
  ) {
    throw new Error(
      `${activity.id} did not produce ${activity.frameCount} frames`,
    )
  }

  const sourceDeltas = loopDeltas(registration.frames)
  const outputDeltas = loopDeltas(animationFrames)
  const sourceMaxDelta = Math.max(...sourceDeltas)
  const outputMaxDelta = Math.max(...outputDeltas)
  if (outputMaxDelta > sourceMaxDelta / 2) {
    throw new Error(
      `${activity.id} interpolation did not reduce adjacent motion: `
      + `${outputMaxDelta.toFixed(4)} vs ${sourceMaxDelta.toFixed(4)}`,
    )
  }

  const animationPath = path.join(candidateRoot, frameName(activity.id))
  const posterPath = path.join(
    candidateRoot,
    frameName(activity.id, 'poster'),
  )
  const stackedFrames = Buffer.concat(animationFrames)
  const animationWebpOptions = activity.id === 'sleep'
    ? {
      lossless: true,
      exact: true,
      effort: 4,
      loop: 0,
      delay: delays,
    }
    : {
      quality: 92,
      alphaQuality: 100,
      exact: true,
      effort: 4,
      smartSubsample: true,
      loop: 0,
      delay: delays,
    }
  await sharp(stackedFrames, {
    raw: {
      width: CELL_SIZE,
      height: CELL_SIZE * activity.frameCount,
      channels: 4,
      pageHeight: CELL_SIZE,
    },
  }).webp(animationWebpOptions).toFile(animationPath)
  await sharp(registration.frames[0], {
    raw: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      channels: 4,
    },
  }).webp({
    lossless: true,
    exact: true,
    effort: 6,
  }).toFile(posterPath)

  const animationContents = await readFile(animationPath)
  const posterContents = await readFile(posterPath)
  const encodedMetadata = await sharp(animationContents, {
    animated: true,
  }).metadata()
  if (
    encodedMetadata.width !== CELL_SIZE
    || encodedMetadata.pageHeight !== CELL_SIZE
    || encodedMetadata.pages !== activity.frameCount
    || encodedMetadata.hasAlpha !== true
    || encodedMetadata.delay?.reduce((sum, delay) => sum + delay, 0)
      !== delays.reduce((sum, delay) => sum + delay, 0)
  ) {
    throw new Error(`${activity.id} animated WebP failed fixed-canvas validation`)
  }

  if (shouldIntegrate) {
    await copyFile(
      animationPath,
      path.join(runtimeRoot, frameName(activity.id)),
    )
    await copyFile(
      posterPath,
      path.join(runtimeRoot, frameName(activity.id, 'poster')),
    )
  }

  manifestRows.push({
    activity: activity.id,
    source: path.relative(root, sourcePath),
    sourceSha256: sha256(sourceContents),
    animation: {
      file: frameName(activity.id),
      sha256: sha256(animationContents),
      bytes: (await stat(animationPath)).size,
      width: CELL_SIZE,
      pageHeight: CELL_SIZE,
      frameCount: activity.frameCount,
      durationMs: delays.reduce((sum, delay) => sum + delay, 0),
    },
    mechanics: activity.mechanics ?? 'motion-compensated',
    poster: {
      file: frameName(activity.id, 'poster'),
      sha256: sha256(posterContents),
      bytes: (await stat(posterPath)).size,
    },
    registration: {
      target: registration.target,
      shifts: registration.shifts,
      sourceAnchors: registration.sourceAnchors,
      registeredAnchors: registration.registeredAnchors,
    },
    continuity: {
      sourceMaxMeanRgbaDelta: sourceMaxDelta,
      outputMaxMeanRgbaDelta: outputMaxDelta,
      maxDeltaRatio: outputMaxDelta / sourceMaxDelta,
    },
  })
  contactSheetRows.push({
    activity: activity.id,
    frames: registration.frames,
    motionFrames: animationFrames,
  })
}

await makeContactSheet(contactSheetRows)
await makeMotionContactSheet(contactSheetRows)
await writeFile(
  path.join(candidateRoot, 'manifest.candidate.json'),
  `${JSON.stringify({
    status: shouldIntegrate
      ? 'integrated-development-preview'
      : 'candidate',
    sourceFrameCount: SOURCE_FRAME_COUNT,
    interpolationSteps: INTERPOLATION_STEPS,
    interpolation: {
      sleep: 'localized-belly-breath',
      otherActivities: 'motion-compensated-bidirectional-aobmc',
    },
    outputFrameCounts: Object.fromEntries(
      activities.map(({ id, frameCount }) => [id, frameCount]),
    ),
    fixedCanvas: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      anchorPrecision: 'integer-pixel',
    },
    contactSheetRows: contactSheetRows.map(({ activity }) => activity),
    rows: manifestRows,
  }, null, 2)}\n`,
)

console.log(
  `built ${activities.length} fixed-canvas Home cat animations`
  + (shouldIntegrate ? ' and integrated v03 runtime assets' : ' as candidates'),
)
