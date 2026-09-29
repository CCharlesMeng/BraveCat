import AppKit
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

private let canvasSize = 1024
private let safeMargin = 64
private let poseOrder = ["sit", "sleep", "walk", "eat", "play", "gaze"]

private struct CatSpec {
  let id: String
  let displayName: String
  let scaleRelativeToMinho: Double
}

private let catSpecs = [
  CatSpec(
    id: "golden-shaded",
    displayName: "Golden shaded / 金渐层",
    scaleRelativeToMinho: 0.96
  ),
  CatSpec(
    id: "blue-golden-shaded",
    displayName: "Blue-golden shaded / 蓝金渐层",
    scaleRelativeToMinho: 1.05
  ),
  CatSpec(
    id: "solid-blue",
    displayName: "Solid blue / 蓝猫",
    scaleRelativeToMinho: 1.10
  ),
  CatSpec(
    id: "blue-white-bicolor",
    displayName: "Blue-white bicolor / 蓝白",
    scaleRelativeToMinho: 1.00
  ),
]

private enum ArtError: Error, CustomStringConvertible {
  case invalidArguments(String)
  case imageLoad(String)
  case imageWrite(String)
  case invalidImage(String)

  var description: String {
    switch self {
    case .invalidArguments(let message),
         .imageLoad(let message),
         .imageWrite(let message),
         .invalidImage(let message):
      return message
    }
  }
}

private struct PixelImage {
  let width: Int
  let height: Int
  var bytes: [UInt8]

  var bytesPerRow: Int { width * 4 }
}

private struct AlphaBounds {
  let minX: Int
  let minY: Int
  let maxX: Int
  let maxY: Int

  var width: Int { maxX - minX + 1 }
  var height: Int { maxY - minY + 1 }
}

private func ensureParentDirectory(of url: URL) throws {
  try FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
}

private func loadCGImage(_ url: URL) throws -> CGImage {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw ArtError.imageLoad("Could not load image: \(url.path)")
  }
  return image
}

private func decodeRGBA(_ image: CGImage) throws -> PixelImage {
  let width = image.width
  let height = image.height
  var bytes = [UInt8](repeating: 0, count: width * height * 4)
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue
    | CGImageAlphaInfo.premultipliedLast.rawValue

  let rendered = bytes.withUnsafeMutableBytes { rawBuffer -> Bool in
    guard let base = rawBuffer.baseAddress,
          let context = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: bitmapInfo
          )
    else { return false }

    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: 1, y: -1)
    context.setBlendMode(.copy)
    context.draw(
      image,
      in: CGRect(x: 0, y: 0, width: width, height: height)
    )
    return true
  }

  guard rendered else {
    throw ArtError.invalidImage("Could not rasterize image")
  }
  return PixelImage(width: width, height: height, bytes: bytes)
}

private func makeCGImage(_ pixels: PixelImage) throws -> CGImage {
  let data = Data(pixels.bytes) as CFData
  guard let provider = CGDataProvider(data: data) else {
    throw ArtError.invalidImage("Could not create image data provider")
  }
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.union(
    CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
  )
  guard let image = CGImage(
    width: pixels.width,
    height: pixels.height,
    bitsPerComponent: 8,
    bitsPerPixel: 32,
    bytesPerRow: pixels.bytesPerRow,
    space: colorSpace,
    bitmapInfo: bitmapInfo,
    provider: provider,
    decode: nil,
    shouldInterpolate: true,
    intent: .defaultIntent
  ) else {
    throw ArtError.invalidImage("Could not create CGImage")
  }
  return image
}

private func writePNG(_ image: CGImage, to url: URL) throws {
  try ensureParentDirectory(of: url)
  guard let destination = CGImageDestinationCreateWithURL(
    url as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
  ) else {
    throw ArtError.imageWrite("Could not create PNG destination: \(url.path)")
  }
  let properties: [CFString: Any] = [
    kCGImagePropertyPNGDictionary: [
      kCGImagePropertyPNGInterlaceType: 0,
    ],
  ]
  CGImageDestinationAddImage(destination, image, properties as CFDictionary)
  guard CGImageDestinationFinalize(destination) else {
    throw ArtError.imageWrite("Could not finalize PNG: \(url.path)")
  }
}

private func alphaBounds(_ pixels: PixelImage, threshold: UInt8 = 2) -> AlphaBounds? {
  var minX = pixels.width
  var minY = pixels.height
  var maxX = -1
  var maxY = -1

  for y in 0..<pixels.height {
    for x in 0..<pixels.width {
      let alpha = pixels.bytes[(y * pixels.width + x) * 4 + 3]
      if alpha > threshold {
        minX = min(minX, x)
        minY = min(minY, y)
        maxX = max(maxX, x)
        maxY = max(maxY, y)
      }
    }
  }

  guard maxX >= minX, maxY >= minY else { return nil }
  return AlphaBounds(minX: minX, minY: minY, maxX: maxX, maxY: maxY)
}

private func sampleKeyColor(_ pixels: PixelImage) -> (Double, Double, Double) {
  let samplePoints = [
    (0, 0),
    (pixels.width - 1, 0),
    (0, pixels.height - 1),
    (pixels.width - 1, pixels.height - 1),
    (pixels.width / 2, 0),
    (pixels.width / 2, pixels.height - 1),
    (0, pixels.height / 2),
    (pixels.width - 1, pixels.height / 2),
  ]
  var red = 0.0
  var green = 0.0
  var blue = 0.0
  for (x, y) in samplePoints {
    let offset = (y * pixels.width + x) * 4
    red += Double(pixels.bytes[offset])
    green += Double(pixels.bytes[offset + 1])
    blue += Double(pixels.bytes[offset + 2])
  }
  let count = Double(samplePoints.count)
  return (red / count, green / count, blue / count)
}

private func removeChroma(
  from input: PixelImage,
  saturation: Double
) throws -> PixelImage {
  let key = sampleKeyColor(input)
  let count = input.width * input.height
  var strongForeground = [Bool](repeating: false, count: count)
  var backgroundDistance = [Int16](repeating: -1, count: count)
  var nearest = [Int32](repeating: -1, count: count)
  var backgroundQueue = [Int32]()
  backgroundQueue.reserveCapacity(count)
  var queue = [Int32]()
  queue.reserveCapacity(count)

  for index in 0..<count {
    let offset = index * 4
    let red = Double(input.bytes[offset])
    let green = Double(input.bytes[offset + 1])
    let blue = Double(input.bytes[offset + 2])
    let distance = sqrt(
      pow(red - key.0, 2)
        + pow(green - key.1, 2)
        + pow(blue - key.2, 2)
    )
    if distance < 48 {
      backgroundDistance[index] = 0
      backgroundQueue.append(Int32(index))
    }
  }

  var backgroundCursor = 0
  while backgroundCursor < backgroundQueue.count {
    let index = Int(backgroundQueue[backgroundCursor])
    backgroundCursor += 1
    let x = index % input.width
    let y = index / input.width
    let distance = backgroundDistance[index]
    let neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < input.width ? index + 1 : -1,
      y > 0 ? index - input.width : -1,
      y + 1 < input.height ? index + input.width : -1,
    ]
    for neighbor in neighbors where neighbor >= 0
      && backgroundDistance[neighbor] < 0
    {
      backgroundDistance[neighbor] = distance + 1
      backgroundQueue.append(Int32(neighbor))
    }
  }

  for index in 0..<count where backgroundDistance[index] >= 3 {
      strongForeground[index] = true
      nearest[index] = Int32(index)
      queue.append(Int32(index))
  }

  guard !queue.isEmpty else {
    throw ArtError.invalidImage("No foreground was detected")
  }

  var cursor = 0
  while cursor < queue.count {
    let index = Int(queue[cursor])
    cursor += 1
    let x = index % input.width
    let y = index / input.width
    let source = nearest[index]
    let neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < input.width ? index + 1 : -1,
      y > 0 ? index - input.width : -1,
      y + 1 < input.height ? index + input.width : -1,
    ]
    for neighbor in neighbors where neighbor >= 0 && nearest[neighbor] < 0 {
      nearest[neighbor] = source
      queue.append(Int32(neighbor))
    }
  }

  var output = input
  for index in 0..<count {
    let offset = index * 4
    let red = Double(input.bytes[offset])
    let green = Double(input.bytes[offset + 1])
    let blue = Double(input.bytes[offset + 2])

    let deltaRed = red - key.0
    let deltaGreen = green - key.1
    let deltaBlue = blue - key.2
    if backgroundDistance[index] == 0 {
      output.bytes[offset] = 0
      output.bytes[offset + 1] = 0
      output.bytes[offset + 2] = 0
      output.bytes[offset + 3] = 0
      continue
    }

    if strongForeground[index] {
      let luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      let foregroundRed = luminance + (red - luminance) * saturation
      let foregroundGreen = luminance + (green - luminance) * saturation
      let foregroundBlue = luminance + (blue - luminance) * saturation
      output.bytes[offset] = UInt8(
        max(0, min(255, foregroundRed)).rounded()
      )
      output.bytes[offset + 1] = UInt8(
        max(0, min(255, foregroundGreen)).rounded()
      )
      output.bytes[offset + 2] = UInt8(
        max(0, min(255, foregroundBlue)).rounded()
      )
      output.bytes[offset + 3] = 255
      continue
    }

    let sourceIndex = Int(nearest[index])
    let sourceOffset = sourceIndex * 4
    let sourceRed = Double(input.bytes[sourceOffset])
    let sourceGreen = Double(input.bytes[sourceOffset + 1])
    let sourceBlue = Double(input.bytes[sourceOffset + 2])
    let vectorRed = sourceRed - key.0
    let vectorGreen = sourceGreen - key.1
    let vectorBlue = sourceBlue - key.2
    let denominator = max(
      1,
      vectorRed * vectorRed
        + vectorGreen * vectorGreen
        + vectorBlue * vectorBlue
    )
    var alpha = (
      deltaRed * vectorRed
        + deltaGreen * vectorGreen
        + deltaBlue * vectorBlue
    ) / denominator

    alpha = max(0, min(1, alpha))

    if alpha < 0.025 {
      output.bytes[offset] = 0
      output.bytes[offset + 1] = 0
      output.bytes[offset + 2] = 0
      output.bytes[offset + 3] = 0
      continue
    }
    if alpha > 0.985 { alpha = 1 }

    var foregroundRed = (red - (1 - alpha) * key.0) / alpha
    var foregroundGreen = (green - (1 - alpha) * key.1) / alpha
    var foregroundBlue = (blue - (1 - alpha) * key.2) / alpha
    foregroundRed = max(0, min(255, foregroundRed))
    foregroundGreen = max(0, min(255, foregroundGreen))
    foregroundBlue = max(0, min(255, foregroundBlue))

    if alpha < 0.96 {
      let solvedLooksGreenSpilled = foregroundGreen
        > max(foregroundRed, foregroundBlue) + 18
        && sourceGreen <= max(sourceRed, sourceBlue) + 12
      let solvedLooksMagentaSpilled = min(foregroundRed, foregroundBlue)
        > foregroundGreen + 38
        && min(sourceRed, sourceBlue) <= sourceGreen + 24
      if solvedLooksGreenSpilled || solvedLooksMagentaSpilled {
        foregroundRed = sourceRed
        foregroundGreen = sourceGreen
        foregroundBlue = sourceBlue
      }
    }

    let luminance = 0.2126 * foregroundRed
      + 0.7152 * foregroundGreen
      + 0.0722 * foregroundBlue
    foregroundRed = luminance + (foregroundRed - luminance) * saturation
    foregroundGreen = luminance + (foregroundGreen - luminance) * saturation
    foregroundBlue = luminance + (foregroundBlue - luminance) * saturation

    output.bytes[offset] = UInt8(
      max(0, min(255, foregroundRed * alpha)).rounded()
    )
    output.bytes[offset + 1] = UInt8(
      max(0, min(255, foregroundGreen * alpha)).rounded()
    )
    output.bytes[offset + 2] = UInt8(
      max(0, min(255, foregroundBlue * alpha)).rounded()
    )
    output.bytes[offset + 3] = UInt8((alpha * 255).rounded())
  }

  return output
}

private func normalizeToMaster(_ image: CGImage) throws -> CGImage {
  let pixels = try decodeRGBA(image)
  guard let bounds = alphaBounds(pixels) else {
    throw ArtError.invalidImage("Transparent source has no visible subject")
  }

  let usable = Double(canvasSize - safeMargin * 2)
  let scale = min(
    usable / Double(bounds.width),
    usable / Double(bounds.height)
  )
  let renderedSubjectWidth = Double(bounds.width) * scale
  let targetSubjectLeft = (Double(canvasSize) - renderedSubjectWidth) / 2
  let targetSubjectBottom = Double(canvasSize - safeMargin)
  let drawX = targetSubjectLeft - Double(bounds.minX) * scale
  let drawY = targetSubjectBottom - Double(bounds.maxY + 1) * scale

  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue
    | CGImageAlphaInfo.premultipliedLast.rawValue
  guard let context = CGContext(
    data: nil,
    width: canvasSize,
    height: canvasSize,
    bitsPerComponent: 8,
    bytesPerRow: canvasSize * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw ArtError.invalidImage("Could not create master canvas")
  }
  context.setBlendMode(.copy)
  context.clear(
    CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize)
  )
  context.interpolationQuality = .high
  context.translateBy(x: 0, y: CGFloat(canvasSize))
  context.scaleBy(x: 1, y: -1)
  context.draw(
    image,
    in: CGRect(
      x: drawX,
      y: drawY,
      width: Double(image.width) * scale,
      height: Double(image.height) * scale
    )
  )
  guard let normalized = context.makeImage() else {
    throw ArtError.invalidImage("Could not render normalized master")
  }
  return normalized
}

private func extractCommand(arguments: [String]) throws {
  guard arguments.count == 4,
        let saturation = Double(arguments[3])
  else {
    throw ArtError.invalidArguments(
      "Usage: build-review-assets.swift extract INPUT OUTPUT SATURATION"
    )
  }
  let inputURL = URL(fileURLWithPath: arguments[1])
  let outputURL = URL(fileURLWithPath: arguments[2])
  let decoded = try decodeRGBA(try loadCGImage(inputURL))
  let extracted = try removeChroma(from: decoded, saturation: saturation)
  let master = try normalizeToMaster(try makeCGImage(extracted))
  try writePNG(master, to: outputURL)
}

private func makeCanvas(
  width: Int,
  height: Int,
  draw: (CGContext) throws -> Void
) throws -> CGImage {
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue
    | CGImageAlphaInfo.premultipliedLast.rawValue
  guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw ArtError.invalidImage("Could not create review canvas")
  }
  try draw(context)
  guard let image = context.makeImage() else {
    throw ArtError.invalidImage("Could not render review canvas")
  }
  return image
}

private func rectFromTop(
  x: Double,
  y: Double,
  width: Double,
  height: Double,
  canvasHeight: Int
) -> CGRect {
  CGRect(
    x: x,
    y: Double(canvasHeight) - y - height,
    width: width,
    height: height
  )
}

private func setFill(
  _ context: CGContext,
  red: Double,
  green: Double,
  blue: Double,
  alpha: Double = 1
) {
  context.setFillColor(
    CGColor(
      red: red / 255,
      green: green / 255,
      blue: blue / 255,
      alpha: alpha
    )
  )
}

private func fillTopRect(
  _ context: CGContext,
  x: Double,
  y: Double,
  width: Double,
  height: Double,
  canvasHeight: Int,
  color: (Double, Double, Double, Double)
) {
  setFill(
    context,
    red: color.0,
    green: color.1,
    blue: color.2,
    alpha: color.3
  )
  context.fill(
    rectFromTop(
      x: x,
      y: y,
      width: width,
      height: height,
      canvasHeight: canvasHeight
    )
  )
}

private func drawText(
  _ text: String,
  context: CGContext,
  x: Double,
  top: Double,
  canvasHeight: Int,
  size: Double,
  weight: NSFont.Weight = .regular,
  color: NSColor = NSColor(
    calibratedRed: 78 / 255,
    green: 80 / 255,
    blue: 68 / 255,
    alpha: 1
  ),
  centeredWidth: Double? = nil
) {
  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: size, weight: weight),
    .foregroundColor: color,
  ]
  let line = CTLineCreateWithAttributedString(
    NSAttributedString(string: text, attributes: attributes)
  )
  let lineWidth = CTLineGetTypographicBounds(line, nil, nil, nil)
  let drawX = centeredWidth.map { x + ($0 - lineWidth) / 2 } ?? x
  context.saveGState()
  context.textMatrix = .identity
  context.textPosition = CGPoint(
    x: drawX,
    y: Double(canvasHeight) - top - size
  )
  CTLineDraw(line, context)
  context.restoreGState()
}

private func drawChecker(
  _ context: CGContext,
  rect: CGRect,
  square: Int = 24
) {
  let columns = Int(ceil(rect.width / Double(square)))
  let rows = Int(ceil(rect.height / Double(square)))
  context.saveGState()
  context.clip(to: rect)
  for row in 0..<rows {
    for column in 0..<columns {
      let light = (row + column).isMultiple(of: 2)
      setFill(
        context,
        red: light ? 246 : 231,
        green: light ? 241 : 232,
        blue: light ? 226 : 214
      )
      context.fill(
        CGRect(
          x: rect.minX + Double(column * square),
          y: rect.minY + Double(row * square),
          width: Double(square),
          height: Double(square)
        )
      )
    }
  }
  context.restoreGState()
}

private func drawImageAspectFit(
  _ image: CGImage,
  context: CGContext,
  rect: CGRect,
  scale: Double = 1
) {
  let ratio = min(
    rect.width / Double(image.width),
    rect.height / Double(image.height)
  ) * scale
  let width = Double(image.width) * ratio
  let height = Double(image.height) * ratio
  let target = CGRect(
    x: rect.midX - width / 2,
    y: rect.midY - height / 2,
    width: width,
    height: height
  )
  context.interpolationQuality = .high
  context.draw(image, in: target)
}

private func resize(_ image: CGImage, width: Int, height: Int) throws -> CGImage {
  try makeCanvas(width: width, height: height) { context in
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(
      image,
      in: CGRect(x: 0, y: 0, width: width, height: height)
    )
  }
}

private func posePath(root: URL, catID: String, pose: String) -> URL {
  root
    .appendingPathComponent("sources")
    .appendingPathComponent(catID)
    .appendingPathComponent(
      "pose--\(catID)--\(pose)--master-1024.png"
    )
}

private func buildContactSheet(root: URL, spec: CatSpec) throws {
  let width = 1800
  let height = 1260
  let sheet = try makeCanvas(width: width, height: height) { context in
    fillTopRect(
      context,
      x: 0,
      y: 0,
      width: Double(width),
      height: Double(height),
      canvasHeight: height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "BRAVECAT · BRITISH SHORTHAIR · NON-SHIPPING VISUAL REVIEW",
      context: context,
      x: 46,
      top: 30,
      canvasHeight: height,
      size: 22,
      weight: .medium
    )
    drawText(
      spec.displayName,
      context: context,
      x: 46,
      top: 66,
      canvasHeight: height,
      size: 42,
      weight: .semibold
    )
    drawText(
      "Six-pose runtime contract · master alpha shown on neutral checker",
      context: context,
      x: 46,
      top: 112,
      canvasHeight: height,
      size: 21,
      color: NSColor(
        calibratedRed: 118 / 255,
        green: 118 / 255,
        blue: 103 / 255,
        alpha: 1
      )
    )

    let cardWidth = 550.0
    let cardHeight = 510.0
    let gapX = 35.0
    let startX = 40.0
    let startY = 165.0
    let gapY = 38.0

    for (index, pose) in poseOrder.enumerated() {
      let column = index % 3
      let row = index / 3
      let x = startX + Double(column) * (cardWidth + gapX)
      let top = startY + Double(row) * (cardHeight + gapY)
      let cardRect = rectFromTop(
        x: x,
        y: top,
        width: cardWidth,
        height: cardHeight,
        canvasHeight: height
      )
      setFill(context, red: 252, green: 249, blue: 239)
      context.addPath(
        CGPath(
          roundedRect: cardRect,
          cornerWidth: 24,
          cornerHeight: 24,
          transform: nil
        )
      )
      context.fillPath()
      context.setStrokeColor(
        CGColor(
          red: 98 / 255,
          green: 98 / 255,
          blue: 82 / 255,
          alpha: 0.22
        )
      )
      context.setLineWidth(2)
      context.addPath(
        CGPath(
          roundedRect: cardRect,
          cornerWidth: 24,
          cornerHeight: 24,
          transform: nil
        )
      )
      context.strokePath()

      drawText(
        pose.uppercased(),
        context: context,
        x: x + 20,
        top: top + 16,
        canvasHeight: height,
        size: 22,
        weight: .semibold
      )
      let artRect = rectFromTop(
        x: x + 32,
        y: top + 52,
        width: cardWidth - 64,
        height: cardHeight - 72,
        canvasHeight: height
      )
      drawChecker(context, rect: artRect)
      let image = try loadCGImage(posePath(root: root, catID: spec.id, pose: pose))
      drawImageAspectFit(image, context: context, rect: artRect)
    }
  }
  let output = root
    .appendingPathComponent("reviews")
    .appendingPathComponent(spec.id)
    .appendingPathComponent(
      "contact-sheet--\(spec.id)--six-poses--non-shipping-v01.png"
    )
  try writePNG(sheet, to: output)
}

private func buildIdentityComparison(root: URL) throws {
  let width = 1800
  let height = 1110
  let sheet = try makeCanvas(width: width, height: height) { context in
    fillTopRect(
      context,
      x: 0,
      y: 0,
      width: Double(width),
      height: Double(height),
      canvasHeight: height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "BRAVECAT · BRITISH SHORTHAIR IDENTITY COMPARISON",
      context: context,
      x: 44,
      top: 28,
      canvasHeight: height,
      size: 25,
      weight: .medium
    )
    drawText(
      "Distinct morphology and stable coat identity · sit + sleep",
      context: context,
      x: 44,
      top: 68,
      canvasHeight: height,
      size: 38,
      weight: .semibold
    )

    let cardWidth = 420.0
    let cardHeight = 440.0
    let gap = 24.0
    let startX = 24.0
    let startY = 138.0
    for (column, spec) in catSpecs.enumerated() {
      drawText(
        spec.displayName,
        context: context,
        x: startX + Double(column) * (cardWidth + gap),
        top: 112,
        canvasHeight: height,
        size: 19,
        weight: .semibold,
        centeredWidth: cardWidth
      )
      for (row, pose) in ["sit", "sleep"].enumerated() {
        let x = startX + Double(column) * (cardWidth + gap)
        let top = startY + Double(row) * (cardHeight + 20)
        let rect = rectFromTop(
          x: x,
          y: top,
          width: cardWidth,
          height: cardHeight,
          canvasHeight: height
        )
        drawChecker(context, rect: rect, square: 22)
        let image = try loadCGImage(
          posePath(root: root, catID: spec.id, pose: pose)
        )
        drawImageAspectFit(image, context: context, rect: rect)
        drawText(
          pose.uppercased(),
          context: context,
          x: x,
          top: top + 8,
          canvasHeight: height,
          size: 17,
          weight: .semibold,
          centeredWidth: cardWidth
        )
      }
    }
  }
  try writePNG(
    sheet,
    to: root
      .appendingPathComponent("reviews")
      .appendingPathComponent(
        "contact-sheet--all-individuals--identity-comparison--non-shipping-v01.png"
      )
  )
}

private func buildRoomComposite(
  root: URL,
  roomURL: URL,
  spec: CatSpec
) throws -> CGImage {
  let room = try loadCGImage(roomURL)
  guard room.width == 1200, room.height == 1600 else {
    throw ArtError.invalidImage("Approved room must be exactly 1200x1600")
  }
  let sleep = try loadCGImage(
    posePath(root: root, catID: spec.id, pose: "sleep")
  )
  let renderedCanvas = 420.0 * spec.scaleRelativeToMinho
  let anchorX = 690.0
  let anchorYTop = 1395.0
  let baselineRatio = 960.0 / 1024.0
  let top = anchorYTop - renderedCanvas * baselineRatio
  let left = anchorX - renderedCanvas / 2

  return try makeCanvas(width: 1200, height: 1600) { context in
    context.setBlendMode(.copy)
    context.draw(
      room,
      in: CGRect(x: 0, y: 0, width: 1200, height: 1600)
    )
    context.setBlendMode(.normal)
    context.interpolationQuality = .high
    context.draw(
      sleep,
      in: rectFromTop(
        x: left,
        y: top,
        width: renderedCanvas,
        height: renderedCanvas,
        canvasHeight: 1600
      )
    )
  }
}

private func buildMobileMockup(
  composite: CGImage,
  templateURL: URL,
  spec: CatSpec,
  outputURL: URL
) throws {
  let template = try loadCGImage(templateURL)
  let width = template.width
  let height = template.height
  let topbarHeight = 82
  let navigationHeight = 112
  let statusHeight = 34
  let roomHeight = height - topbarHeight - navigationHeight - statusHeight
  let scale = max(
    Double(width) / 1200,
    Double(roomHeight) / 1600
  )
  let renderedWidth = 1200.0 * scale
  let renderedHeight = 1600.0 * scale
  let renderedX = (Double(width) - renderedWidth) / 2
  let renderedTop = Double(topbarHeight)
    + (Double(roomHeight) - renderedHeight) / 2

  let mockup = try makeCanvas(width: width, height: height) { context in
    context.setBlendMode(.copy)
    context.draw(
      template,
      in: CGRect(x: 0, y: 0, width: width, height: height)
    )
    context.saveGState()
    context.clip(
      to: rectFromTop(
        x: 0,
        y: Double(topbarHeight),
        width: Double(width),
        height: Double(roomHeight),
        canvasHeight: height
      )
    )
    context.interpolationQuality = .high
    context.draw(
      composite,
      in: rectFromTop(
        x: renderedX,
        y: renderedTop,
        width: renderedWidth,
        height: renderedHeight,
        canvasHeight: height
      )
    )
    context.restoreGState()

    fillTopRect(
      context,
      x: 0,
      y: 0,
      width: Double(width),
      height: 26,
      canvasHeight: height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "BRAVECAT · \(spec.id.uppercased()) · NON-SHIPPING",
      context: context,
      x: 16,
      top: 8,
      canvasHeight: height,
      size: 8.5,
      weight: .medium
    )
    fillTopRect(
      context,
      x: 0,
      y: Double(height - statusHeight),
      width: Double(width),
      height: Double(statusHeight),
      canvasHeight: height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "SLEEP · HOME RUG SCALE / BASELINE QA",
      context: context,
      x: 0,
      top: Double(height - 22),
      canvasHeight: height,
      size: 8.5,
      weight: .medium,
      centeredWidth: Double(width)
    )
  }
  try writePNG(mockup, to: outputURL)
}

private func alphaReportEntry(_ image: CGImage) throws -> [String: Any] {
  let pixels = try decodeRGBA(image)
  guard let bounds = alphaBounds(pixels) else {
    throw ArtError.invalidImage("Master contains no visible alpha")
  }
  var transparent = 0
  var partial = 0
  var hiddenRGBNonzero = 0
  var magentaOpaque = 0
  for index in 0..<(pixels.width * pixels.height) {
    let offset = index * 4
    let alpha = Int(pixels.bytes[offset + 3])
    if alpha == 0 {
      transparent += 1
      if pixels.bytes[offset] != 0
        || pixels.bytes[offset + 1] != 0
        || pixels.bytes[offset + 2] != 0
      {
        hiddenRGBNonzero += 1
      }
    } else if alpha < 255 {
      partial += 1
    }
    if alpha > 8 {
      let divisor = max(1.0, Double(alpha) / 255)
      let red = Double(pixels.bytes[offset]) / divisor
      let green = Double(pixels.bytes[offset + 1]) / divisor
      let blue = Double(pixels.bytes[offset + 2]) / divisor
      if red > 238, blue > 218, green < 35 {
        magentaOpaque += 1
      }
    }
  }
  return [
    "width": pixels.width,
    "height": pixels.height,
    "pixelMode": "RGBA",
    "alpha": "straight PNG semantics; premultiplied during raster processing",
    "transparentPixelCount": transparent,
    "partiallyTransparentPixelCount": partial,
    "hiddenRgbNonzeroPixelCount": hiddenRGBNonzero,
    "opaqueMagentaPixelCount": magentaOpaque,
    "bboxTopLeft": [
      bounds.minX,
      bounds.minY,
      bounds.maxX + 1,
      bounds.maxY + 1,
    ],
    "marginsPx": [
      "left": bounds.minX,
      "top": bounds.minY,
      "right": pixels.width - bounds.maxX - 1,
      "bottom": pixels.height - bounds.maxY - 1,
    ],
  ]
}

private func buildCommand(arguments: [String]) throws {
  guard arguments.count == 6 else {
    throw ArtError.invalidArguments(
      "Usage: build-review-assets.swift build ROOT ROOM TEMPLATE_390 TEMPLATE_430"
    )
  }
  let root = URL(fileURLWithPath: arguments[1])
  let roomURL = URL(fileURLWithPath: arguments[2])
  let template390 = URL(fileURLWithPath: arguments[3])
  let template430 = URL(fileURLWithPath: arguments[4])
  let reportURL = URL(fileURLWithPath: arguments[5])

  var reportCats: [[String: Any]] = []
  for spec in catSpecs {
    var poseReports: [String: Any] = [:]
    for pose in poseOrder {
      let sourceURL = posePath(root: root, catID: spec.id, pose: pose)
      let source = try loadCGImage(sourceURL)
      let runtime = try resize(source, width: 512, height: 512)
      let runtimeURL = root
        .appendingPathComponent("runtime")
        .appendingPathComponent(spec.id)
        .appendingPathComponent(
          "pose--\(spec.id)--\(pose)--runtime-512.png"
        )
      try writePNG(runtime, to: runtimeURL)
      poseReports[pose] = try alphaReportEntry(source)
    }

    try buildContactSheet(root: root, spec: spec)
    let composite = try buildRoomComposite(
      root: root,
      roomURL: roomURL,
      spec: spec
    )
    let reviewDirectory = root
      .appendingPathComponent("reviews")
      .appendingPathComponent(spec.id)
    try writePNG(
      composite,
      to: reviewDirectory.appendingPathComponent(
        "room-composite--\(spec.id)--sleep--1200x1600--non-shipping-v01.png"
      )
    )
    try buildMobileMockup(
      composite: composite,
      templateURL: template390,
      spec: spec,
      outputURL: reviewDirectory.appendingPathComponent(
        "home-mockup--\(spec.id)--390x844--non-shipping-v01.png"
      )
    )
    try buildMobileMockup(
      composite: composite,
      templateURL: template430,
      spec: spec,
      outputURL: reviewDirectory.appendingPathComponent(
        "home-mockup--\(spec.id)--430x932--non-shipping-v01.png"
      )
    )
    reportCats.append([
      "id": spec.id,
      "scaleRelativeToMinho": spec.scaleRelativeToMinho,
      "sourceAnchor": [
        "kind": "bottom-center alpha baseline",
        "x": 512,
        "y": 960,
      ],
      "homeRoomAnchor": [
        "x": 690,
        "y": 1395,
      ],
      "poses": poseReports,
    ])
  }
  try buildIdentityComparison(root: root)

  let report: [String: Any] = [
    "schemaVersion": 1,
    "status": "NON-SHIPPING / VISUAL-REVIEW-ONLY",
    "sourceCanvas": [
      "width": 1024,
      "height": 1024,
      "safeMarginPx": 64,
    ],
    "runtimeCanvas": [
      "width": 512,
      "height": 512,
    ],
    "approvedRoomSource": roomURL.path,
    "cats": reportCats,
  ]
  let data = try JSONSerialization.data(
    withJSONObject: report,
    options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  )
  try ensureParentDirectory(of: reportURL)
  try data.write(to: reportURL)
}

do {
  let arguments = CommandLine.arguments
  guard arguments.count >= 2 else {
    throw ArtError.invalidArguments(
      "Commands: extract or build"
    )
  }
  switch arguments[1] {
  case "extract":
    try extractCommand(arguments: Array(arguments.dropFirst()))
  case "build":
    try buildCommand(arguments: Array(arguments.dropFirst()))
  default:
    throw ArtError.invalidArguments("Unknown command: \(arguments[1])")
  }
} catch {
  FileHandle.standardError.write(
    Data("error: \(error)\n".utf8)
  )
  exit(1)
}
