import AppKit

struct RGB {
  let r: CGFloat
  let g: CGFloat
  let b: CGFloat
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let iconURL = root.appendingPathComponent("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
let splashURLs = [
  root.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png"),
  root.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png"),
  root.appendingPathComponent("ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png"),
]

func color(_ value: RGB) -> NSColor {
  NSColor(calibratedRed: value.r, green: value.g, blue: value.b, alpha: 1)
}

func savePNG(size: Int, url: URL, draw: (CGRect) -> Void) throws {
  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NSError(domain: "RecallFlowAssets", code: 1)
  }

  let previous = NSGraphicsContext.current
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  draw(CGRect(x: 0, y: 0, width: size, height: size))
  NSGraphicsContext.current = previous

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "RecallFlowAssets", code: 2)
  }

  try png.write(to: url)
}

func drawRounded(_ rect: CGRect, radius: CGFloat, fill: RGB) {
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  color(fill).setFill()
  path.fill()
}

func drawMark(in rect: CGRect) {
  color(RGB(r: 0.07, g: 0.09, b: 0.15)).setFill()
  rect.fill()

  let cardBack = CGRect(x: rect.width * 0.27, y: rect.height * 0.29, width: rect.width * 0.44, height: rect.height * 0.48)
  drawRounded(cardBack.offsetBy(dx: 54, dy: 40), radius: 46, fill: RGB(r: 0.06, g: 0.62, b: 0.56))
  drawRounded(cardBack.offsetBy(dx: 22, dy: 20), radius: 46, fill: RGB(r: 0.31, g: 0.27, b: 0.90))
  drawRounded(cardBack, radius: 46, fill: RGB(r: 0.97, g: 0.98, b: 1.0))

  color(RGB(r: 0.07, g: 0.09, b: 0.15)).setStroke()
  for index in 0..<3 {
    let y = cardBack.maxY - 120 - CGFloat(index * 96)
    let line = NSBezierPath()
    line.lineWidth = 24
    line.lineCapStyle = .round
    line.move(to: CGPoint(x: cardBack.minX + 72, y: y))
    line.line(to: CGPoint(x: cardBack.maxX - 72, y: y))
    line.stroke()
  }

  let spark = NSBezierPath()
  spark.lineWidth = 34
  spark.lineCapStyle = .round
  color(RGB(r: 0.96, g: 0.62, b: 0.04)).setStroke()
  let cx = rect.width * 0.67
  let cy = rect.height * 0.66
  spark.move(to: CGPoint(x: cx, y: cy - 78))
  spark.line(to: CGPoint(x: cx, y: cy + 78))
  spark.move(to: CGPoint(x: cx - 78, y: cy))
  spark.line(to: CGPoint(x: cx + 78, y: cy))
  spark.stroke()
}

func drawSplash(in rect: CGRect) {
  color(RGB(r: 0.96, g: 0.98, b: 1.0)).setFill()
  rect.fill()
  let mark = CGRect(x: rect.midX - 390, y: rect.midY - 310, width: 780, height: 780)
  drawMark(in: mark)

  let titleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 118, weight: .bold),
    .foregroundColor: color(RGB(r: 0.07, g: 0.09, b: 0.15)),
  ]
  let subtitleAttrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 48, weight: .semibold),
    .foregroundColor: color(RGB(r: 0.39, g: 0.45, b: 0.55)),
  ]
  let title = "RecallFlow"
  let subtitle = "Build smarter flashcards"
  let titleSize = title.size(withAttributes: titleAttrs)
  let subtitleSize = subtitle.size(withAttributes: subtitleAttrs)
  title.draw(at: CGPoint(x: rect.midX - titleSize.width / 2, y: mark.minY - 210), withAttributes: titleAttrs)
  subtitle.draw(at: CGPoint(x: rect.midX - subtitleSize.width / 2, y: mark.minY - 292), withAttributes: subtitleAttrs)
}

try savePNG(size: 1024, url: iconURL) { rect in
  drawMark(in: rect)
}

for url in splashURLs {
  try savePNG(size: 2732, url: url) { rect in
    drawSplash(in: rect)
  }
}

print("Generated RecallFlow iOS assets.")
