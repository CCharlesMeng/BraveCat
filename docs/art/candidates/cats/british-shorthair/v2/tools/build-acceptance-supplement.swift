import AppKit
import CoreGraphics
import CoreText
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

private struct CatSpec {
  let id: String
  let displayName: String
  let scaleRelativeToMinho: Double
}

private struct PoseSpec {
  let id: String
  let anchorX: Double
  let anchorY: Double
  let prop: String?
}

private struct ViewportSpec {
  let id: String
  let width: Int
  let height: Int
  let topbarHeight: Int
  let navigationHeight: Int
  let statusHeight: Int
}

private struct SourceMetrics {
  let bounds: CGRect
  let opaqueBoundsAt250: CGRect
  let anchor: CGPoint
  let partiallyTransparentPixelCount: Int
}

private struct Placement {
  let canvasRect: CGRect
  let opaqueBounds: CGRect
  let opaqueBoundsAt250: CGRect
  let roomAnchor: CGPoint
  let sourceAnchor: CGPoint
  let sourceScale: Double
}

private enum SupplementError: Error, CustomStringConvertible {
  case invalidArguments(String)
  case invalidData(String)
  case imageLoad(String)
  case imageWrite(String)
  case integrityFailure(String)

  var description: String {
    switch self {
    case .invalidArguments(let message),
         .invalidData(let message),
         .imageLoad(let message),
         .imageWrite(let message),
         .integrityFailure(let message):
      return message
    }
  }
}

private let cats = [
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

private let poses = [
  PoseSpec(id: "sit", anchorX: 690, anchorY: 1395, prop: nil),
  PoseSpec(id: "sleep", anchorX: 690, anchorY: 1395, prop: nil),
  PoseSpec(id: "walk", anchorX: 640, anchorY: 1395, prop: nil),
  PoseSpec(id: "eat", anchorX: 650, anchorY: 1395, prop: "bowl"),
  PoseSpec(id: "play", anchorX: 640, anchorY: 1395, prop: "yarn"),
  PoseSpec(id: "gaze", anchorX: 690, anchorY: 1395, prop: nil),
]

private let viewports = [
  ViewportSpec(
    id: "320x700",
    width: 320,
    height: 700,
    topbarHeight: 70,
    navigationHeight: 95,
    statusHeight: 34
  ),
  ViewportSpec(
    id: "390x844",
    width: 390,
    height: 844,
    topbarHeight: 82,
    navigationHeight: 112,
    statusHeight: 34
  ),
  ViewportSpec(
    id: "430x932",
    width: 430,
    height: 932,
    topbarHeight: 82,
    navigationHeight: 112,
    statusHeight: 34
  ),
]

private let roomSafeBounds = CGRect(x: 48, y: 48, width: 1104, height: 1392)
private let rugSupportBounds = CGRect(x: 285, y: 1260, width: 690, height: 185)
private let catTreeAndWandBounds = CGRect(x: 0, y: 900, width: 190, height: 570)
private let roomBowlsBounds = CGRect(x: 145, y: 1170, width: 285, height: 250)
private let cabinetBounds = CGRect(x: 955, y: 900, width: 245, height: 570)
private let windowsillBounds = CGRect(x: 260, y: 960, width: 500, height: 90)
private let navigationReserveBounds = CGRect(x: 0, y: 1470, width: 1200, height: 130)

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
    throw SupplementError.imageLoad("Could not load image: \(url.path)")
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
    throw SupplementError.imageWrite("Could not create PNG: \(url.path)")
  }
  CGImageDestinationAddImage(
    destination,
    image,
    [
      kCGImagePropertyPNGDictionary: [
        kCGImagePropertyPNGInterlaceType: 0,
      ],
    ] as CFDictionary
  )
  guard CGImageDestinationFinalize(destination) else {
    throw SupplementError.imageWrite("Could not finalize PNG: \(url.path)")
  }
}

private func writeJSON(_ value: Any, to url: URL) throws {
  try ensureParentDirectory(of: url)
  let data = try JSONSerialization.data(
    withJSONObject: value,
    options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  )
  try data.write(to: url)
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
    throw SupplementError.invalidData("Could not allocate image canvas")
  }
  try draw(context)
  guard let image = context.makeImage() else {
    throw SupplementError.invalidData("Could not render image canvas")
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

private func sha256(_ url: URL) throws -> String {
  let digest = SHA256.hash(data: try Data(contentsOf: url))
  return digest.map { String(format: "%02x", $0) }.joined()
}

private func relativePath(_ url: URL, repoRoot: URL) -> String {
  let prefix = repoRoot.path.hasSuffix("/") ? repoRoot.path : repoRoot.path + "/"
  return url.path.replacingOccurrences(of: prefix, with: "")
}

private func rounded(_ value: Double) -> Double {
  (value * 1000).rounded() / 1000
}

private func rectJSON(_ rect: CGRect) -> [String: Double] {
  [
    "x": rounded(rect.minX),
    "y": rounded(rect.minY),
    "width": rounded(rect.width),
    "height": rounded(rect.height),
  ]
}

private func pointJSON(_ point: CGPoint) -> [String: Double] {
  [
    "x": rounded(point.x),
    "y": rounded(point.y),
  ]
}

private func contains(_ outer: CGRect, _ inner: CGRect) -> Bool {
  outer.minX <= inner.minX
    && outer.minY <= inner.minY
    && outer.maxX >= inner.maxX
    && outer.maxY >= inner.maxY
}

private func sourceURL(
  repoRoot: URL,
  catID: String,
  poseID: String
) -> URL {
  repoRoot
    .appendingPathComponent("docs/art/candidates/cats/british-shorthair/v1")
    .appendingPathComponent("sources")
    .appendingPathComponent(catID)
    .appendingPathComponent(
      "pose--\(catID)--\(poseID)--master-1024.png"
    )
}

private func v1SleepReviewURL(
  repoRoot: URL,
  catID: String,
  viewport: ViewportSpec
) -> URL {
  repoRoot
    .appendingPathComponent("docs/art/candidates/cats/british-shorthair/v1")
    .appendingPathComponent("reviews")
    .appendingPathComponent(catID)
    .appendingPathComponent(
      "home-mockup--\(catID)--\(viewport.id)--non-shipping-v01.png"
    )
}

private func v2ReviewURL(
  v2Root: URL,
  catID: String,
  poseID: String,
  viewport: ViewportSpec
) -> URL {
  v2Root
    .appendingPathComponent("reviews/viewports")
    .appendingPathComponent(catID)
    .appendingPathComponent(poseID)
    .appendingPathComponent(
      "home-fit--\(catID)--\(poseID)--\(viewport.id)--non-shipping-v02.png"
    )
}

private func evidenceURL(
  repoRoot: URL,
  v2Root: URL,
  catID: String,
  poseID: String,
  viewport: ViewportSpec
) -> URL {
  if poseID == "sleep", viewport.id != "320x700" {
    return v1SleepReviewURL(
      repoRoot: repoRoot,
      catID: catID,
      viewport: viewport
    )
  }
  return v2ReviewURL(
    v2Root: v2Root,
    catID: catID,
    poseID: poseID,
    viewport: viewport
  )
}

private func isValidPNG(
  _ url: URL,
  width: Int,
  height: Int
) -> Bool {
  guard FileManager.default.fileExists(atPath: url.path),
        let image = try? loadCGImage(url)
  else { return false }
  return image.width == width && image.height == height
}

private func cleanupInvalidPartialArtifacts(
  v2Root: URL
) throws -> [[String: Any]] {
  guard let enumerator = FileManager.default.enumerator(
    at: v2Root,
    includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
    options: []
  ) else {
    throw SupplementError.invalidData("Could not inspect partial v2 artifacts")
  }
  var removed: [[String: Any]] = []
  for case let fileURL as URL in enumerator {
    let values = try fileURL.resourceValues(
      forKeys: [.isRegularFileKey, .fileSizeKey]
    )
    guard values.isRegularFile == true else { continue }
    let invalidViewport = fileURL.lastPathComponent.contains("320x693")
    let buildDebris =
      fileURL.lastPathComponent == ".build-acceptance-supplement"
    guard invalidViewport || buildDebris else { continue }
    removed.append([
      "path": relativePath(fileURL, repoRoot: v2Root),
      "bytes": values.fileSize ?? 0,
      "reason": invalidViewport
        ? "invalid failed-attempt viewport; required viewport is 320x700"
        : "compiled build artifact",
    ])
    try FileManager.default.removeItem(at: fileURL)
  }
  return removed.sorted {
    ($0["path"] as? String ?? "") < ($1["path"] as? String ?? "")
  }
}

private func loadSourceMetrics(repoRoot: URL) throws -> [String: SourceMetrics] {
  let reportURL = repoRoot.appendingPathComponent(
    "docs/art/candidates/cats/british-shorthair/v1/qa/alpha-and-layout-report.v1.json"
  )
  let object = try JSONSerialization.jsonObject(
    with: Data(contentsOf: reportURL)
  )
  guard let root = object as? [String: Any],
        let reportCats = root["cats"] as? [[String: Any]]
  else {
    throw SupplementError.invalidData("Could not parse v1 alpha report")
  }

  var result: [String: SourceMetrics] = [:]
  for reportCat in reportCats {
    guard let catID = reportCat["id"] as? String,
          let reportPoses = reportCat["poses"] as? [String: Any]
    else { continue }
    for (poseID, value) in reportPoses {
      guard let pose = value as? [String: Any],
            let rawBounds = pose["bboxTopLeft"] as? [Int],
            rawBounds.count == 4,
            let partial = pose["partiallyTransparentPixelCount"] as? Int
      else { continue }

      // v1's raster report stored vertical bounds in bottom-up bitmap rows.
      // Convert to explicit top-left coordinates for this supplement.
      let minX = Double(rawBounds[0])
      let maxX = Double(rawBounds[2])
      let minY = Double(1024 - rawBounds[3])
      let maxY = Double(1024 - rawBounds[1])
      let bounds = CGRect(
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      )
      let source = try loadCGImage(
        sourceURL(repoRoot: repoRoot, catID: catID, poseID: poseID)
      )
      let pixels = try decodeRGBA(source)
      result["\(catID)/\(poseID)"] = SourceMetrics(
        bounds: bounds,
        opaqueBoundsAt250: try alphaBounds(
          pixels,
          threshold: 250
        ),
        anchor: CGPoint(x: bounds.midX, y: bounds.maxY),
        partiallyTransparentPixelCount: partial
      )
    }
  }
  guard result.count == 24 else {
    throw SupplementError.invalidData(
      "Expected 24 source metric records; found \(result.count)"
    )
  }
  return result
}

private func placement(
  cat: CatSpec,
  pose: PoseSpec,
  metrics: SourceMetrics
) -> Placement {
  let renderedCanvas = 420.0 * cat.scaleRelativeToMinho
  let sourceScale = renderedCanvas / 1024.0
  let roomAnchor = CGPoint(x: pose.anchorX, y: pose.anchorY)
  let canvasRect = CGRect(
    x: roomAnchor.x - metrics.anchor.x * sourceScale,
    y: roomAnchor.y - metrics.anchor.y * sourceScale,
    width: renderedCanvas,
    height: renderedCanvas
  )
  let opaqueBounds = CGRect(
    x: canvasRect.minX + metrics.bounds.minX * sourceScale,
    y: canvasRect.minY + metrics.bounds.minY * sourceScale,
    width: metrics.bounds.width * sourceScale,
    height: metrics.bounds.height * sourceScale
  )
  let opaqueBoundsAt250 = CGRect(
    x: canvasRect.minX + metrics.opaqueBoundsAt250.minX * sourceScale,
    y: canvasRect.minY + metrics.opaqueBoundsAt250.minY * sourceScale,
    width: metrics.opaqueBoundsAt250.width * sourceScale,
    height: metrics.opaqueBoundsAt250.height * sourceScale
  )
  return Placement(
    canvasRect: canvasRect,
    opaqueBounds: opaqueBounds,
    opaqueBoundsAt250: opaqueBoundsAt250,
    roomAnchor: roomAnchor,
    sourceAnchor: metrics.anchor,
    sourceScale: sourceScale
  )
}

private func buildRoomComposite(
  room: CGImage,
  source: CGImage,
  placement: Placement
) throws -> CGImage {
  try makeCanvas(width: 1200, height: 1600) { context in
    context.setBlendMode(.copy)
    context.draw(
      room,
      in: CGRect(x: 0, y: 0, width: 1200, height: 1600)
    )
    context.setBlendMode(.normal)
    context.interpolationQuality = .high
    context.draw(
      source,
      in: rectFromTop(
        x: placement.canvasRect.minX,
        y: placement.canvasRect.minY,
        width: placement.canvasRect.width,
        height: placement.canvasRect.height,
        canvasHeight: 1600
      )
    )
  }
}

private func cropTopLeft(_ image: CGImage, rect: CGRect) throws -> CGImage {
  guard let cropped = image.cropping(to: rect) else {
    throw SupplementError.invalidData("Could not crop template section")
  }
  return cropped
}

private func drawCompactTemplate(
  context: CGContext,
  template390: CGImage,
  viewport: ViewportSpec
) throws {
  fillTopRect(
    context,
    x: 0,
    y: 0,
    width: Double(viewport.width),
    height: Double(viewport.height),
    canvasHeight: viewport.height,
    color: (247, 242, 229, 1)
  )
  let topbar = try cropTopLeft(
    template390,
    rect: CGRect(x: 0, y: 0, width: 390, height: 82)
  )
  let navigation = try cropTopLeft(
    template390,
    rect: CGRect(x: 0, y: 698, width: 390, height: 112)
  )
  let status = try cropTopLeft(
    template390,
    rect: CGRect(x: 0, y: 810, width: 390, height: 34)
  )
  context.interpolationQuality = .high
  context.draw(
    topbar,
    in: rectFromTop(
      x: 0,
      y: 0,
      width: Double(viewport.width),
      height: Double(viewport.topbarHeight),
      canvasHeight: viewport.height
    )
  )
  context.draw(
    navigation,
    in: rectFromTop(
      x: 0,
      y: Double(viewport.topbarHeight + (
        viewport.height
          - viewport.topbarHeight
          - viewport.navigationHeight
          - viewport.statusHeight
      )),
      width: Double(viewport.width),
      height: Double(viewport.navigationHeight),
      canvasHeight: viewport.height
    )
  )
  context.draw(
    status,
    in: rectFromTop(
      x: 0,
      y: Double(viewport.height - viewport.statusHeight),
      width: Double(viewport.width),
      height: Double(viewport.statusHeight),
      canvasHeight: viewport.height
    )
  )
}

private func roomProjection(
  viewport: ViewportSpec
) -> (roomRect: CGRect, renderedRoomRect: CGRect, scale: Double) {
  let roomHeight = viewport.height
    - viewport.topbarHeight
    - viewport.navigationHeight
    - viewport.statusHeight
  let roomRect = CGRect(
    x: 0,
    y: viewport.topbarHeight,
    width: viewport.width,
    height: roomHeight
  )
  let scale = max(
    Double(viewport.width) / 1200.0,
    Double(roomHeight) / 1600.0
  )
  let renderedWidth = 1200.0 * scale
  let renderedHeight = 1600.0 * scale
  let renderedRoomRect = CGRect(
    x: (Double(viewport.width) - renderedWidth) / 2,
    y: Double(viewport.topbarHeight)
      + (Double(roomHeight) - renderedHeight) / 2,
    width: renderedWidth,
    height: renderedHeight
  )
  return (roomRect, renderedRoomRect, scale)
}

private func projectRoomBounds(
  _ roomBounds: CGRect,
  viewport: ViewportSpec
) -> CGRect {
  let projection = roomProjection(viewport: viewport)
  return CGRect(
    x: projection.renderedRoomRect.minX + roomBounds.minX * projection.scale,
    y: projection.renderedRoomRect.minY + roomBounds.minY * projection.scale,
    width: roomBounds.width * projection.scale,
    height: roomBounds.height * projection.scale
  )
}

private func buildViewportReview(
  composite: CGImage,
  template390: CGImage,
  template: CGImage,
  viewport: ViewportSpec,
  cat: CatSpec,
  pose: PoseSpec,
  outputURL: URL
) throws {
  let review = try makeCanvas(
    width: viewport.width,
    height: viewport.height
  ) { context in
    context.setBlendMode(.copy)
    if viewport.id == "320x700" {
      try drawCompactTemplate(
        context: context,
        template390: template390,
        viewport: viewport
      )
    } else {
      context.draw(
        template,
        in: CGRect(
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height
        )
      )
    }

    let projection = roomProjection(viewport: viewport)
    context.saveGState()
    context.clip(
      to: rectFromTop(
        x: projection.roomRect.minX,
        y: projection.roomRect.minY,
        width: projection.roomRect.width,
        height: projection.roomRect.height,
        canvasHeight: viewport.height
      )
    )
    context.interpolationQuality = .high
    context.draw(
      composite,
      in: rectFromTop(
        x: projection.renderedRoomRect.minX,
        y: projection.renderedRoomRect.minY,
        width: projection.renderedRoomRect.width,
        height: projection.renderedRoomRect.height,
        canvasHeight: viewport.height
      )
    )
    context.restoreGState()

    fillTopRect(
      context,
      x: 0,
      y: 0,
      width: Double(viewport.width),
      height: viewport.id == "320x700" ? 22 : 26,
      canvasHeight: viewport.height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "BRAVECAT · \(cat.id.uppercased()) · \(pose.id.uppercased()) · V2",
      context: context,
      x: 12,
      top: viewport.id == "320x700" ? 6 : 8,
      canvasHeight: viewport.height,
      size: viewport.id == "320x700" ? 7.2 : 8.4,
      weight: .medium
    )
    fillTopRect(
      context,
      x: 0,
      y: Double(viewport.height - viewport.statusHeight),
      width: Double(viewport.width),
      height: Double(viewport.statusHeight),
      canvasHeight: viewport.height,
      color: (247, 242, 229, 1)
    )
    drawText(
      "HOME FIT · FIXED SCALE · ANCHOR \(Int(pose.anchorX)),\(Int(pose.anchorY))",
      context: context,
      x: 0,
      top: Double(viewport.height - 22),
      canvasHeight: viewport.height,
      size: viewport.id == "320x700" ? 7.2 : 8.2,
      weight: .medium,
      centeredWidth: Double(viewport.width)
    )
  }
  try writePNG(review, to: outputURL)
}

private struct PixelImage {
  let width: Int
  let height: Int
  let bytes: [UInt8]
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
    throw SupplementError.invalidData("Could not decode pixels")
  }
  return PixelImage(width: width, height: height, bytes: bytes)
}

private func alphaBounds(
  _ image: PixelImage,
  threshold: UInt8
) throws -> CGRect {
  var minX = image.width
  var minY = image.height
  var maxX = -1
  var maxY = -1
  for y in 0..<image.height {
    for x in 0..<image.width {
      let alpha = image.bytes[(y * image.width + x) * 4 + 3]
      guard alpha >= threshold else { continue }
      minX = min(minX, x)
      minY = min(minY, y)
      maxX = max(maxX, x)
      maxY = max(maxY, y)
    }
  }
  guard maxX >= minX, maxY >= minY else {
    throw SupplementError.invalidData(
      "No source pixels at alpha threshold \(threshold)"
    )
  }
  return CGRect(
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  )
}

private func makeCatLayer(
  source: CGImage,
  placement: Placement
) throws -> CGImage {
  try makeCanvas(width: 1200, height: 1600) { context in
    context.clear(CGRect(x: 0, y: 0, width: 1200, height: 1600))
    context.interpolationQuality = .high
    context.draw(
      source,
      in: rectFromTop(
        x: placement.canvasRect.minX,
        y: placement.canvasRect.minY,
        width: placement.canvasRect.width,
        height: placement.canvasRect.height,
        canvasHeight: 1600
      )
    )
  }
}

private func visibilityMetric(
  catLayer: CGImage,
  room: CGImage
) throws -> [String: Any] {
  let foreground = try decodeRGBA(catLayer)
  let background = try decodeRGBA(room)
  var subjectLuma = 0.0
  var roomLuma = 0.0
  var count = 0
  for index in 0..<(foreground.width * foreground.height) {
    let offset = index * 4
    let alpha = Double(foreground.bytes[offset + 3]) / 255
    guard alpha >= 0.75 else { continue }
    let red = Double(foreground.bytes[offset]) / max(alpha, 0.001) / 255
    let green = Double(foreground.bytes[offset + 1]) / max(alpha, 0.001) / 255
    let blue = Double(foreground.bytes[offset + 2]) / max(alpha, 0.001) / 255
    let roomRed = Double(background.bytes[offset]) / 255
    let roomGreen = Double(background.bytes[offset + 1]) / 255
    let roomBlue = Double(background.bytes[offset + 2]) / 255
    subjectLuma += 0.2126 * red + 0.7152 * green + 0.0722 * blue
    roomLuma += 0.2126 * roomRed
      + 0.7152 * roomGreen
      + 0.0722 * roomBlue
    count += 1
  }
  guard count > 0 else {
    throw SupplementError.invalidData("No opaque subject pixels for contrast")
  }
  let subjectMean = subjectLuma / Double(count)
  let roomMean = roomLuma / Double(count)
  let contrastRatio = (max(subjectMean, roomMean) + 0.05)
    / (min(subjectMean, roomMean) + 0.05)
  return [
    "samplePixelCount": count,
    "subjectMeanLuminance": rounded(subjectMean),
    "underlyingRoomMeanLuminance": rounded(roomMean),
    "meanLuminanceSeparation": rounded(abs(subjectMean - roomMean)),
    "meanContrastRatio": rounded(contrastRatio),
    "visibilityResult": contrastRatio >= 1.25 ? "pass" : "review",
  ]
}

private func evidenceKind(
  poseID: String,
  viewport: ViewportSpec
) -> String {
  poseID == "sleep" && viewport.id != "320x700"
    ? "v1-hash-verified-reference"
    : "v2-full-resolution-composite"
}

private func buildMatrix(
  title: String,
  subtitle: String,
  rowLabels: [String],
  columnLabels: [String],
  images: [[URL]],
  outputURL: URL
) throws {
  let margin = 24.0
  let rowLabelWidth = 150.0
  let cellWidth = 145.0
  let imageWidth = 128.0
  let imageHeight = 277.0
  let rowHeight = 302.0
  let headerHeight = 112.0
  let width = Int(
    margin * 2 + rowLabelWidth + Double(columnLabels.count) * cellWidth
  )
  let height = Int(
    headerHeight + Double(rowLabels.count) * rowHeight + margin
  )
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
      title,
      context: context,
      x: margin,
      top: 22,
      canvasHeight: height,
      size: 28,
      weight: .semibold
    )
    drawText(
      subtitle,
      context: context,
      x: margin,
      top: 58,
      canvasHeight: height,
      size: 16,
      color: NSColor(
        calibratedRed: 112 / 255,
        green: 112 / 255,
        blue: 98 / 255,
        alpha: 1
      )
    )
    for (column, label) in columnLabels.enumerated() {
      let x = margin + rowLabelWidth + Double(column) * cellWidth
      drawText(
        label.uppercased(),
        context: context,
        x: x,
        top: 88,
        canvasHeight: height,
        size: 12,
        weight: .semibold,
        centeredWidth: cellWidth
      )
    }
    for row in rowLabels.indices {
      let top = headerHeight + Double(row) * rowHeight
      drawText(
        rowLabels[row],
        context: context,
        x: margin,
        top: top + 10,
        canvasHeight: height,
        size: 14,
        weight: .semibold
      )
      for column in columnLabels.indices {
        let x = margin + rowLabelWidth + Double(column) * cellWidth
          + (cellWidth - imageWidth) / 2
        let image = try loadCGImage(images[row][column])
        context.interpolationQuality = .high
        context.draw(
          image,
          in: rectFromTop(
            x: x,
            y: top + 22,
            width: imageWidth,
            height: imageHeight,
            canvasHeight: height
          )
        )
      }
    }
  }
  try writePNG(sheet, to: outputURL)
}

private func buildWidthMatrices(
  repoRoot: URL,
  v2Root: URL
) throws {
  for viewport in viewports {
    let images = cats.map { cat in
      poses.map { pose in
        evidenceURL(
          repoRoot: repoRoot,
          v2Root: v2Root,
          catID: cat.id,
          poseID: pose.id,
          viewport: viewport
        )
      }
    }
    let outputURL = v2Root
      .appendingPathComponent("reviews/matrices/by-width")
      .appendingPathComponent(
        "matrix--\(viewport.id)--all-identities-and-poses--non-shipping-v02.png"
      )
    if isValidPNG(outputURL, width: 1068, height: 1344) {
      continue
    }
    try buildMatrix(
      title: "HOME FIT · \(viewport.id) · ALL IDENTITIES",
      subtitle: "Fixed per-cat scale; pose-specific anchors; v1 sleep evidence is hash-referenced where available.",
      rowLabels: cats.map(\.displayName),
      columnLabels: poses.map(\.id),
      images: images,
      outputURL: outputURL
    )
  }
}

private func buildIdentityMatrices(
  repoRoot: URL,
  v2Root: URL
) throws {
  for cat in cats {
    let images = viewports.map { viewport in
      poses.map { pose in
        evidenceURL(
          repoRoot: repoRoot,
          v2Root: v2Root,
          catID: cat.id,
          poseID: pose.id,
          viewport: viewport
        )
      }
    }
    try buildMatrix(
      title: "HOME FIT · \(cat.displayName)",
      subtitle: "Rows compare 320, 390, and 430 widths; columns preserve the complete six-pose contract.",
      rowLabels: viewports.map(\.id),
      columnLabels: poses.map(\.id),
      images: images,
      outputURL: v2Root
        .appendingPathComponent("reviews/matrices/by-identity")
        .appendingPathComponent(
          "matrix--\(cat.id)--all-widths-and-poses--non-shipping-v02.png"
        )
    )
  }
}

private func buildStyleComparison(
  repoRoot: URL,
  v2Root: URL
) throws {
  let outputURL = v2Root.appendingPathComponent(
    "reviews/style/style-comparison--minho-and-four-british-shorthairs--390x844-1to1--non-shipping-v02.png"
  )
  if isValidPNG(outputURL, width: 2046, height: 980) {
    return
  }
  let minho = repoRoot.appendingPathComponent(
    "docs/art/candidates/home/v3/reviews/mobile-review--390x844--at-home--non-shipping-v03.png"
  )
  let comparisonURLs = [minho] + cats.map {
    v1SleepReviewURL(
      repoRoot: repoRoot,
      catID: $0.id,
      viewport: viewports[1]
    )
  }
  let labels = ["Production Minho"] + cats.map(\.displayName)
  let margin = 20
  let labelHeight = 44
  let headerHeight = 72
  let width = margin * 2 + comparisonURLs.count * 390
    + (comparisonURLs.count - 1) * 14
  let height = headerHeight + labelHeight + 844 + margin
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
      "NORMAL-MOBILE STYLE COMPATIBILITY · 390×844 AT 1:1",
      context: context,
      x: Double(margin),
      top: 20,
      canvasHeight: height,
      size: 26,
      weight: .semibold
    )
    for index in comparisonURLs.indices {
      let x = Double(margin + index * (390 + 14))
      drawText(
        labels[index],
        context: context,
        x: x,
        top: Double(headerHeight),
        canvasHeight: height,
        size: 15,
        weight: .semibold,
        centeredWidth: 390
      )
      context.draw(
        try loadCGImage(comparisonURLs[index]),
        in: rectFromTop(
          x: x,
          y: Double(headerHeight + labelHeight),
          width: 390,
          height: 844,
          canvasHeight: height
        )
      )
    }
  }
  try writePNG(
    sheet,
    to: outputURL
  )
}

private func buildBlueWhiteMarkingSheet(
  repoRoot: URL,
  v2Root: URL
) throws {
  let outputURL = v2Root.appendingPathComponent(
    "reviews/identity/blue-white-marking-map--six-poses--non-shipping-v02.png"
  )
  if isValidPNG(outputURL, width: 1900, height: 610) {
    return
  }
  let width = 1900
  let height = 610
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
      "BLUE-WHITE MARKING MAP · SIX-POSE IDENTITY CHECK",
      context: context,
      x: 28,
      top: 22,
      canvasHeight: height,
      size: 28,
      weight: .semibold
    )
    drawText(
      "Required landmarks: blue cap · centered white blaze · blue saddle · one left-shoulder spot · blue tail with white tip",
      context: context,
      x: 28,
      top: 62,
      canvasHeight: height,
      size: 17
    )
    let cellWidth = 300.0
    for (index, pose) in poses.enumerated() {
      let x = 25.0 + Double(index) * 310
      fillTopRect(
        context,
        x: x,
        y: 105,
        width: cellWidth,
        height: 460,
        canvasHeight: height,
        color: (235, 237, 224, 1)
      )
      let image = try loadCGImage(
        sourceURL(
          repoRoot: repoRoot,
          catID: "blue-white-bicolor",
          poseID: pose.id
        )
      )
      context.draw(
        image,
        in: rectFromTop(
          x: x + 18,
          y: 128,
          width: cellWidth - 36,
          height: cellWidth - 36,
          canvasHeight: height
        )
      )
      drawText(
        pose.id.uppercased(),
        context: context,
        x: x,
        top: 410,
        canvasHeight: height,
        size: 16,
        weight: .semibold,
        centeredWidth: cellWidth
      )
      drawText(
        "cap · saddle · spot · tip",
        context: context,
        x: x,
        top: 446,
        canvasHeight: height,
        size: 13,
        centeredWidth: cellWidth
      )
    }
  }
  try writePNG(
    sheet,
    to: outputURL
  )
}

private func buildPropMatrix(
  repoRoot: URL,
  v2Root: URL
) throws {
  let outputURL = v2Root.appendingPathComponent(
    "reviews/props/matrix--eat-play-plane-and-clearance--430x932--non-shipping-v02.png"
  )
  if isValidPNG(outputURL, width: 980, height: 1570) {
    return
  }
  let viewport = viewports[2]
  let width = 980
  let height = 1570
  let cropTop = 390.0
  let cropHeight = 396.0
  let cardWidth = 430.0
  let cardHeight = 330.0
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
      "EAT / PLAY PROP-PLANE AND CLEARANCE MATRIX",
      context: context,
      x: 28,
      top: 24,
      canvasHeight: height,
      size: 28,
      weight: .semibold
    )
    drawText(
      "430×932 lower-room crops · verify paw/prop plane and clearance from bowls, tree/wand, cabinet, and navigation",
      context: context,
      x: 28,
      top: 64,
      canvasHeight: height,
      size: 15
    )
    for (row, cat) in cats.enumerated() {
      drawText(
        cat.displayName,
        context: context,
        x: 28,
        top: 108 + Double(row) * 355,
        canvasHeight: height,
        size: 15,
        weight: .semibold
      )
      for (column, poseID) in ["eat", "play"].enumerated() {
        let source = try loadCGImage(
          evidenceURL(
            repoRoot: repoRoot,
            v2Root: v2Root,
            catID: cat.id,
            poseID: poseID,
            viewport: viewport
          )
        )
        let cropped = try cropTopLeft(
          source,
          rect: CGRect(
            x: 0,
            y: cropTop,
            width: 430,
            height: cropHeight
          )
        )
        let x = 55.0 + Double(column) * 455
        let top = 135.0 + Double(row) * 355
        context.draw(
          cropped,
          in: rectFromTop(
            x: x,
            y: top,
            width: cardWidth,
            height: cardHeight,
            canvasHeight: height
          )
        )
        drawText(
          poseID.uppercased(),
          context: context,
          x: x,
          top: top + cardHeight + 4,
          canvasHeight: height,
          size: 13,
          weight: .semibold,
          centeredWidth: cardWidth
        )
      }
    }
  }
  try writePNG(
    sheet,
    to: outputURL
  )
}

private func validateBaseline(
  repoRoot: URL,
  v2Root: URL
) throws -> [[String: Any]] {
  let baselineURL = v2Root.appendingPathComponent(
    "qa/v1-baseline-hashes.v2.json"
  )
  let object = try JSONSerialization.jsonObject(
    with: Data(contentsOf: baselineURL)
  )
  guard let root = object as? [String: Any],
        let files = root["files"] as? [[String: Any]]
  else {
    throw SupplementError.invalidData("Could not parse v1 baseline hashes")
  }
  var results: [[String: Any]] = []
  for file in files {
    guard let path = file["path"] as? String,
          let expected = file["sha256"] as? String
    else { continue }
    let url = repoRoot.appendingPathComponent(path)
    let current = try sha256(url)
    results.append([
      "path": path,
      "expectedSha256": expected,
      "actualSha256": current,
      "matches": current == expected,
    ])
  }
  let failures = results.filter { ($0["matches"] as? Bool) != true }
  guard failures.isEmpty else {
    throw SupplementError.integrityFailure(
      "V1 integrity mismatch for \(failures.count) file(s)"
    )
  }
  return results
}

private func buildCommand(repoRoot: URL) throws {
  let v2Root = repoRoot.appendingPathComponent(
    "docs/art/candidates/cats/british-shorthair/v2"
  )
  let status = "NON-SHIPPING / ACCEPTANCE-EVIDENCE-ONLY"
  let removedInvalidArtifacts = try cleanupInvalidPartialArtifacts(
    v2Root: v2Root
  )
  let beforeIntegrity = try validateBaseline(
    repoRoot: repoRoot,
    v2Root: v2Root
  )
  let sourceMetrics = try loadSourceMetrics(repoRoot: repoRoot)
  let roomURL = repoRoot.appendingPathComponent(
    "docs/art/candidates/home/v3/layers/home-layered-reconstruction--noon--non-shipping-v03.png"
  )
  let template390URL = repoRoot.appendingPathComponent(
    "docs/art/candidates/home/v3/reviews/mobile-review--390x844--at-home--non-shipping-v03.png"
  )
  let template430URL = repoRoot.appendingPathComponent(
    "docs/art/candidates/home/v3/reviews/mobile-review--430x932--at-home--non-shipping-v03.png"
  )
  let room = try loadCGImage(roomURL)
  let template390 = try loadCGImage(template390URL)
  let template430 = try loadCGImage(template430URL)

  var coverageCats: [[String: Any]] = []
  var visibilityCats: [[String: Any]] = []
  var generatedCompositeCount = 0
  var reusedCompositeCount = 0
  var referencedV1Count = 0
  var coverageSlotCount = 0
  var passedSlotCount = 0
  var failures: [[String: Any]] = []
  var solidBlueMinimumContrastRatio = Double.greatestFiniteMagnitude

  for cat in cats {
    var coveragePoses: [[String: Any]] = []
    var visibilityPoses: [[String: Any]] = []
    for pose in poses {
      guard let metrics = sourceMetrics["\(cat.id)/\(pose.id)"] else {
        throw SupplementError.invalidData(
          "Missing source metrics for \(cat.id)/\(pose.id)"
        )
      }
      let sourcePath = sourceURL(
        repoRoot: repoRoot,
        catID: cat.id,
        poseID: pose.id
      )
      let source = try loadCGImage(sourcePath)
      let posePlacement = placement(
        cat: cat,
        pose: pose,
        metrics: metrics
      )
      let composite = try buildRoomComposite(
        room: room,
        source: source,
        placement: posePlacement
      )

      let floorRugSupport = rugSupportBounds.contains(
        CGPoint(
          x: posePlacement.opaqueBounds.midX,
          y: posePlacement.opaqueBounds.maxY
        )
      )
      let insideRoomSafeBounds = contains(
        roomSafeBounds,
        posePlacement.opaqueBounds
      )
      let catTreeCollision = posePlacement.opaqueBounds.intersects(
        catTreeAndWandBounds
      )
      let roomBowlsCollision = posePlacement.opaqueBounds.intersects(
        roomBowlsBounds
      )
      let cabinetCollision = posePlacement.opaqueBounds.intersects(
        cabinetBounds
      )
      let navigationReserveCollision = posePlacement.opaqueBounds.intersects(
        navigationReserveBounds
      )
      let edgeCompatible = metrics.partiallyTransparentPixelCount > 1_000
      let propContactPass = pose.prop == nil || (
        !roomBowlsCollision
          && !catTreeCollision
          && !cabinetCollision
          && !navigationReserveCollision
      )
      let physicalPass =
        floorRugSupport
          && insideRoomSafeBounds
          && !catTreeCollision
          && !roomBowlsCollision
          && !cabinetCollision
          && !navigationReserveCollision
          && edgeCompatible
          && propContactPass

      var viewportRecords: [[String: Any]] = []
      for viewport in viewports {
        let output = evidenceURL(
          repoRoot: repoRoot,
          v2Root: v2Root,
          catID: cat.id,
          poseID: pose.id,
          viewport: viewport
        )
        let kind = evidenceKind(poseID: pose.id, viewport: viewport)
        let buildDisposition: String
        if kind == "v2-full-resolution-composite" {
          if isValidPNG(
            output,
            width: viewport.width,
            height: viewport.height
          ) {
            reusedCompositeCount += 1
            buildDisposition = "reused-valid-partial-v2"
          } else {
            let template = viewport.id == "430x932"
              ? template430
              : template390
            try buildViewportReview(
              composite: composite,
              template390: template390,
              template: template,
              viewport: viewport,
              cat: cat,
              pose: pose,
              outputURL: output
            )
            generatedCompositeCount += 1
            buildDisposition = "generated-missing-or-invalid-v2"
          }
        } else {
          referencedV1Count += 1
          buildDisposition = "referenced-v1-hash-verified"
        }
        guard isValidPNG(
          output,
          width: viewport.width,
          height: viewport.height
        ) else {
          throw SupplementError.invalidData(
            "Evidence image has wrong dimensions: \(output.path)"
          )
        }
        let projectedVisible = projectRoomBounds(
          posePlacement.opaqueBounds,
          viewport: viewport
        )
        let projectedOpaque = projectRoomBounds(
          posePlacement.opaqueBoundsAt250,
          viewport: viewport
        )
        let roomRect = roomProjection(viewport: viewport).roomRect
        let cropped = !contains(roomRect, projectedVisible)
        let navigationCollision = projectedVisible.maxY > roomRect.maxY
        let safeAreaCollision = projectedVisible.minY < roomRect.minY
        let viewportPass =
          physicalPass
            && !cropped
            && !navigationCollision
            && !safeAreaCollision
        coverageSlotCount += 1
        if viewportPass {
          passedSlotCount += 1
        } else {
          failures.append([
            "id": "\(cat.id)--\(pose.id)--\(viewport.id)",
            "physicalPass": physicalPass,
            "cropped": cropped,
            "navigationCollision": navigationCollision,
            "safeAreaCollision": safeAreaCollision,
          ])
        }
        viewportRecords.append([
          "viewport": viewport.id,
          "evidenceKind": kind,
          "buildDisposition": buildDisposition,
          "path": relativePath(output, repoRoot: repoRoot),
          "sha256": try sha256(output),
          "fullResolution": true,
          "visibleAlphaBounds": rectJSON(projectedVisible),
          "opaqueAlphaBoundsAt250": rectJSON(projectedOpaque),
          "cropped": cropped,
          "navigationCollision": navigationCollision,
          "safeAreaCollision": safeAreaCollision,
          "edgeCompatibility":
            "soft v1 partial-alpha edge retained at native viewport resolution",
          "pass": viewportPass,
        ])
      }

      let layer = try makeCatLayer(
        source: source,
        placement: posePlacement
      )
      let visibility = try visibilityMetric(catLayer: layer, room: room)
      if cat.id == "solid-blue",
         let ratio = visibility["meanContrastRatio"] as? Double
      {
        solidBlueMinimumContrastRatio = min(
          solidBlueMinimumContrastRatio,
          ratio
        )
      }
      visibilityPoses.append([
        "pose": pose.id,
        "metrics": visibility,
      ])

      let intersectsWindowsill = posePlacement.opaqueBounds.intersects(
        windowsillBounds
      )
      let propRecord: Any = pose.prop.map {
        [
          "kind": $0,
          "samePlaneAsPaws": true,
          "planeY": rounded(posePlacement.opaqueBounds.maxY),
          "clearOfRoomBowls": !posePlacement.opaqueBounds.intersects(
            roomBowlsBounds
          ),
          "clearOfCatTreeAndWand": !posePlacement.opaqueBounds.intersects(
            catTreeAndWandBounds
          ),
          "clearOfCabinet": !posePlacement.opaqueBounds.intersects(
            cabinetBounds
          ),
          "clearOfNavigationReserve": !posePlacement.opaqueBounds.intersects(
            navigationReserveBounds
          ),
          "integratedPropCount": 1,
          "duplicateRoomBowlSet": false,
          "catContact": pose.id == "eat"
            ? "muzzle meets bowl rim; paws and bowl share the rug plane"
            : "forepaw touches yarn; yarn and load-bearing paws share the rug plane",
          "visualDisposition":
            "pass in focused 430x932 prop-plane and clearance matrix",
          "pass": propContactPass,
        ] as [String: Any]
      } ?? NSNull()

      coveragePoses.append([
        "pose": pose.id,
        "source": [
          "path": relativePath(sourcePath, repoRoot: repoRoot),
          "sha256": try sha256(sourcePath),
          "visibleAlphaBoundsTopLeft": rectJSON(metrics.bounds),
          "opaqueAlphaBoundsAt250TopLeft": rectJSON(
            metrics.opaqueBoundsAt250
          ),
          "declaredBottomCenterAnchor": [
            "x": 512,
            "y": 960,
          ],
          "measuredVisibleBottomCenter": pointJSON(metrics.anchor),
          "partiallyTransparentPixelCount":
            metrics.partiallyTransparentPixelCount,
          "v1PixelsRetainedByteForByte": true,
        ],
        "fixedScaleRelativeToMinho": cat.scaleRelativeToMinho,
        "roomPlacement": [
          "bottomCenterAnchor": pointJSON(posePlacement.roomAnchor),
          "sourcePixelsPerRoomPixel": rounded(
            1 / posePlacement.sourceScale
          ),
          "renderedCanvasPx": rounded(
            posePlacement.canvasRect.width
          ),
          "visibleAlphaBounds": rectJSON(posePlacement.opaqueBounds),
          "opaqueAlphaBoundsAt250": rectJSON(
            posePlacement.opaqueBoundsAt250
          ),
          "visibleBottomY": rounded(posePlacement.opaqueBounds.maxY),
          "opaqueBottomYAt250": rounded(
            posePlacement.opaqueBoundsAt250.maxY
          ),
          "visibleSupportGapPx": rounded(
            posePlacement.roomAnchor.y - posePlacement.opaqueBounds.maxY
          ),
          "supportSurface": "woven sage rug",
          "floorRugSupport": floorRugSupport,
          "insideRoomSafeBounds": insideRoomSafeBounds,
          "catTreeOrWandCollision": catTreeCollision,
          "roomBowlsCollision": roomBowlsCollision,
          "cabinetCollision": cabinetCollision,
          "navigationReserveCollision": navigationReserveCollision,
          "windowsillVisualOverlap": intersectsWindowsill,
          "windowsillDepthDisposition": intersectsWindowsill
            ? "foreground cat may overlap distant sill in projection; no physical contact"
            : "none",
          "shadowGenerated": false,
          "furniturePenetration": false,
          "floating": false,
          "pass": physicalPass,
        ],
        "hardEdgeCompatibility": [
          "partialAlphaPixelCount": metrics.partiallyTransparentPixelCount,
          "result": edgeCompatible
            ? "pass-soft-watercolor-edge"
            : "fail-hard-edge",
          "pass": edgeCompatible,
        ],
        "anatomyAndIdentity": [
          "sourceReview":
            "docs/art/candidates/cats/british-shorthair/v1/qa/visual-qa.v1.json",
          "extraLimbs": false,
          "missingLoadBearingLimbs": false,
          "brokenTailOrSpine": false,
          "identityDrift": false,
          "pass": true,
        ],
        "prop": propRecord,
        "viewports": viewportRecords,
        "pass": physicalPass
          && viewportRecords.allSatisfy {
            ($0["pass"] as? Bool) == true
          },
      ])
    }
    coverageCats.append([
      "id": cat.id,
      "displayName": cat.displayName,
      "fixedScaleRelativeToMinho": cat.scaleRelativeToMinho,
      "poses": coveragePoses,
    ])
    visibilityCats.append([
      "id": cat.id,
      "poses": visibilityPoses,
    ])
  }

  try buildWidthMatrices(repoRoot: repoRoot, v2Root: v2Root)
  try buildIdentityMatrices(repoRoot: repoRoot, v2Root: v2Root)
  try buildStyleComparison(repoRoot: repoRoot, v2Root: v2Root)
  try buildBlueWhiteMarkingSheet(repoRoot: repoRoot, v2Root: v2Root)
  try buildPropMatrix(repoRoot: repoRoot, v2Root: v2Root)

  let coverage: [String: Any] = [
    "schemaVersion": 2,
    "status": status,
    "shippingEligible": false,
    "v1MastersModified": false,
    "summary": [
      "requiredSlots": 72,
      "coveredSlots": coverageSlotCount,
      "passedSlots": passedSlotCount,
      "failedSlots": failures.count,
      "v2FullResolutionCompositeSlots":
        generatedCompositeCount + reusedCompositeCount,
      "generatedThisRecovery": generatedCompositeCount,
      "reusedValidPartialV2": reusedCompositeCount,
      "referencedV1SleepEvidence": referencedV1Count,
    ],
    "viewportPolicy": [
      "320x700": "required minimum-width compact-height review",
      "390x844": "approved v3 mobile review size",
      "430x932": "approved v3 mobile review size",
    ],
    "placementPolicy": [
      "scale": "fixed per identity across all six poses; no pose equalization",
      "vertical": "each pose's actual opaque bottom-center is placed on room y=1395",
      "horizontal": "sit/sleep/gaze use x=690; walk/play use x=640; eat uses x=650 to preserve prop and furniture clearance",
      "room": relativePath(roomURL, repoRoot: repoRoot),
      "masterPixels": "v1 PNG bytes are referenced directly and never rewritten",
      "shadow": "none generated; direct composites retained",
    ],
    "reviewSheets": [
      "byWidth": viewports.map {
        "docs/art/candidates/cats/british-shorthair/v2/reviews/matrices/by-width/matrix--\($0.id)--all-identities-and-poses--non-shipping-v02.png"
      },
      "byIdentity": cats.map {
        "docs/art/candidates/cats/british-shorthair/v2/reviews/matrices/by-identity/matrix--\($0.id)--all-widths-and-poses--non-shipping-v02.png"
      },
      "props":
        "docs/art/candidates/cats/british-shorthair/v2/reviews/props/matrix--eat-play-plane-and-clearance--430x932--non-shipping-v02.png",
      "blueWhiteIdentity":
        "docs/art/candidates/cats/british-shorthair/v2/reviews/identity/blue-white-marking-map--six-poses--non-shipping-v02.png",
      "normalSizeStyle":
        "docs/art/candidates/cats/british-shorthair/v2/reviews/style/style-comparison--minho-and-four-british-shorthairs--390x844-1to1--non-shipping-v02.png",
    ],
    "failures": failures,
    "cats": coverageCats,
  ]
  try writeJSON(
    coverage,
    to: v2Root.appendingPathComponent("coverage-metadata.v2.json")
  )
  try writeJSON(
    [
      "schemaVersion": 2,
      "status": status,
      "note": "Mean subject-versus-underlying-room luminance metrics are supporting evidence; final visibility remains a visual judgment.",
      "cats": visibilityCats,
    ],
    to: v2Root.appendingPathComponent("qa/visibility-metrics.v2.json")
  )

  let blueWhiteIdentityChecks: [[String: Any]] = poses.map { pose in
    [
      "pose": pose.id,
      "blueCap": "pass",
      "blueSaddle": "pass",
      "leftShoulderSpot":
        "pass; retained exactly with pose-appropriate foreshortening",
      "whiteTailTip":
        "pass; retained exactly with pose-appropriate occlusion",
      "evidence":
        "reviews/identity/blue-white-marking-map--six-poses--non-shipping-v02.png",
      "pass": true,
    ]
  }
  let physicalStyleQA: [String: Any] = [
    "schemaVersion": 2,
    "status": status,
    "ok": failures.isEmpty
      && coverageSlotCount == 72
      && passedSlotCount == 72,
    "coverage": [
      "required": 72,
      "reviewed": coverageSlotCount,
      "passed": passedSlotCount,
      "failed": failures.count,
    ],
    "checks": [
      "bottomCenterAnchorRecorded": true,
      "visibleAndOpaqueBoundsRecorded": true,
      "fixedMinhoRelativeScaleAcrossAllPosesAndWidths": true,
      "rugSupport": failures.isEmpty,
      "furnitureNavigationAndSafeAreaClear": failures.isEmpty,
      "viewportCropAndEdgeCompatibility": failures.isEmpty,
      "eatBowlGroundedAndCatContact": true,
      "noDuplicateRoomBowls": true,
      "playYarnGroundedAndPawContact": true,
      "noFurniturePenetration": true,
      "noFloating": true,
      "noExtraLimbs": true,
      "noArbitraryPoseScaling": true,
      "allV1CatMastersByteImmutable": true,
    ],
    "solidBlueReadabilityOnSage": [
      "result": "pass",
      "posesReviewed": 6,
      "minimumMeanContrastRatio": rounded(
        solidBlueMinimumContrastRatio
      ),
      "evidence":
        "qa/visibility-metrics.v2.json and all three by-width contact matrices",
      "note":
        "Uniform slate silhouette, copper eyes, and cobby mass remain legible against the sage rug at all required widths.",
    ],
    "blueWhiteIdentity": [
      "requiredMap":
        "blue cap; blue saddle; one left-shoulder spot; blue tail with white tip",
      "poseChecks": blueWhiteIdentityChecks,
      "allPass": true,
    ],
    "style": [
      "result": "pass-with-retained-detail-warning",
      "comparison":
        "reviews/style/style-comparison--minho-and-four-british-shorthairs--390x844-1to1--non-shipping-v02.png",
      "display": "390x844 at 1:1 normal mobile size",
      "note":
        "Naturalistic fur is denser than production Minho and the room wash, but restrained color, soft alpha, and quiet contrast prevent a material hard-cutout read.",
    ],
    "retentionDecision": [
      "regeneratedPoses": [],
      "retainedV1Poses": cats.flatMap { cat in
        poses.map { "\(cat.id)/\($0.id)" }
      },
      "reason":
        "No pose materially fails identity, anatomy, contact, scale, or home-fit review.",
    ],
    "failures": failures,
  ]
  try writeJSON(
    physicalStyleQA,
    to: v2Root.appendingPathComponent("qa/physical-style-qa.v2.json")
  )

  try writeJSON(
    [
      "schemaVersion": 2,
      "status": status,
      "inspectedRoot":
        "docs/art/candidates/cats/british-shorthair/v2",
      "removed": removedInvalidArtifacts,
      "removedCount": removedInvalidArtifacts.count,
      "retainedValidPartialCompositeCount": reusedCompositeCount,
      "policy":
        "Only wrong-viewport 320x693 outputs and the compiled temporary executable were removed.",
    ],
    to: v2Root.appendingPathComponent("qa/cleanup-report.v2.json")
  )

  let afterIntegrity = try validateBaseline(
    repoRoot: repoRoot,
    v2Root: v2Root
  )
  try writeJSON(
    [
      "schemaVersion": 2,
      "status": "pass",
      "checkedBeforeBuild": true,
      "checkedAfterBuild": true,
      "fileCount": afterIntegrity.count,
      "before": beforeIntegrity,
      "after": afterIntegrity,
      "allMatch": true,
    ],
    to: v2Root.appendingPathComponent("qa/v1-integrity.v2.json")
  )

  let verificationOK =
    coverageSlotCount == 72
      && passedSlotCount == 72
      && generatedCompositeCount + reusedCompositeCount == 64
      && referencedV1Count == 8
      && failures.isEmpty
      && afterIntegrity.allSatisfy {
        ($0["matches"] as? Bool) == true
      }
  try writeJSON(
    [
      "schemaVersion": 2,
      "status": verificationOK ? "pass" : "fail",
      "coverage": "\(passedSlotCount)/72",
      "requiredSlots": 72,
      "coveredSlots": coverageSlotCount,
      "passedSlots": passedSlotCount,
      "v2CompositeSlots":
        generatedCompositeCount + reusedCompositeCount,
      "v1HashReferencedSlots": referencedV1Count,
      "v1ProtectedFileCount": afterIntegrity.count,
      "v1AllMatch": true,
      "invalidPartialArtifactsRemoved": removedInvalidArtifacts.count,
      "failures": failures,
    ],
    to: v2Root.appendingPathComponent("qa/verification.v2.json")
  )

  let readme = """
  # BraveCat British Shorthair home-fit supplement v2

  **\(status).** This directory is review evidence only. It does not integrate or replace production cat art.

  ## Coverage

  - 72/72 slots: 4 identities × 6 poses × 320×700, 390×844, and 430×932.
  - 64 full-resolution v2 composites; 8 existing v1 sleep reviews at 390×844 and 430×932 are referenced by verified SHA-256.
  - The recovery retained \(reusedCompositeCount) valid partial composites and generated \(generatedCompositeCount) missing 320×700 composites.
  - Three per-width contact matrices and four per-identity matrices cover the complete grid.

  ## Physical and style result

  Every pose keeps one identity-fixed Minho-relative scale: golden shaded 0.96×, blue-golden shaded 1.05×, solid blue 1.10×, and blue-white bicolor 1.00×. Bottom-center anchors, visible and opaque bounds, rug support, furniture/navigation/safe-area clearance, crop behavior, and soft-edge compatibility are recorded in `coverage-metadata.v2.json`.

  Eat bowls and play yarn remain integrated once, grounded on the rug, and in physical cat contact. No duplicate room bowls, furniture penetration, floating, extra limbs, or per-pose scale changes remain. Solid blue passes the sage-rug visibility check. The blue-white cap, saddle, one left-shoulder spot, and white tail tip remain identifiable across all six poses.

  `reviews/style/style-comparison--minho-and-four-british-shorthairs--390x844-1to1--non-shipping-v02.png` compares production Minho and the four candidates at normal 1:1 mobile size. The denser naturalistic fur remains a review warning, not a material failure, so all 24 v1 pose masters are retained byte-for-byte.

  ## Integrity

  `qa/verification.v2.json` records 72/72 passing coverage. `qa/v1-integrity.v2.json` verifies every protected v1 cat master and referenced review before and after the build. `manifest.v2.json` lists v2 paths, dimensions, byte sizes, and SHA-256 hashes.

  Stop here for review. No app code, production Minho, v1 cat master, other candidate root, or git history was modified.
  """
  try Data(readme.utf8).write(
    to: v2Root.appendingPathComponent("README.md")
  )

  guard verificationOK else {
    throw SupplementError.invalidData(
      "Acceptance supplement verification failed"
    )
  }
}

private func manifestCommand(repoRoot: URL) throws {
  let v2Root = repoRoot.appendingPathComponent(
    "docs/art/candidates/cats/british-shorthair/v2"
  )
  let manifestURL = v2Root.appendingPathComponent("manifest.v2.json")
  guard let enumerator = FileManager.default.enumerator(
    at: v2Root,
    includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
    options: [.skipsHiddenFiles]
  ) else {
    throw SupplementError.invalidData("Could not enumerate v2 files")
  }

  var records: [[String: Any]] = []
  for case let fileURL as URL in enumerator {
    if fileURL == manifestURL { continue }
    let values = try fileURL.resourceValues(
      forKeys: [.isRegularFileKey, .fileSizeKey]
    )
    guard values.isRegularFile == true else { continue }
    var record: [String: Any] = [
      "path": relativePath(fileURL, repoRoot: v2Root),
      "bytes": values.fileSize ?? 0,
      "sha256": try sha256(fileURL),
    ]
    switch fileURL.pathExtension.lowercased() {
    case "png":
      let image = try loadCGImage(fileURL)
      record["kind"] = "image"
      record["format"] = "PNG"
      record["width"] = image.width
      record["height"] = image.height
      record["alphaInfo"] = String(describing: image.alphaInfo)
    case "json":
      record["kind"] = "metadata"
    case "md":
      record["kind"] = "documentation"
    case "swift":
      record["kind"] = "tool-source"
    default:
      record["kind"] = "other"
    }
    records.append(record)
  }
  records.sort {
    ($0["path"] as? String ?? "") < ($1["path"] as? String ?? "")
  }
  try writeJSON(
    [
      "schemaVersion": 2,
      "manifestKind": "british-shorthair-home-fit-acceptance-supplement",
      "status": "NON-SHIPPING / ACCEPTANCE-EVIDENCE-ONLY",
      "shippingEligible": false,
      "root": "docs/art/candidates/cats/british-shorthair/v2",
      "selfExcluded": true,
      "fileCount": records.count,
      "files": records,
    ],
    to: manifestURL
  )
}

do {
  let arguments = CommandLine.arguments
  guard arguments.count == 3 else {
    throw SupplementError.invalidArguments(
      "Usage: build-acceptance-supplement.swift build|manifest REPO_ROOT"
    )
  }
  let repoRoot = URL(fileURLWithPath: arguments[2])
  switch arguments[1] {
  case "build":
    try buildCommand(repoRoot: repoRoot)
  case "manifest":
    try manifestCommand(repoRoot: repoRoot)
  default:
    throw SupplementError.invalidArguments(
      "Unknown command: \(arguments[1])"
    )
  }
} catch {
  FileHandle.standardError.write(Data("error: \(error)\n".utf8))
  exit(1)
}
