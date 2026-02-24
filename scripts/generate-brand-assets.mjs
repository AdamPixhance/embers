import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import toIco from 'to-ico'

const rootDir = process.cwd()
const iconDir = path.join(rootDir, 'assets', 'icons')
const sourceSvg = path.join(rootDir, 'assets', 'brand', 'brand-mark.svg')

const iconSizes = [256, 128, 64, 32]
const windowPngSize = 512

await fs.mkdir(iconDir, { recursive: true })

const svgBuffer = await fs.readFile(sourceSvg)

const circleSvg = (size, inset = 12) => {
  const radius = (size - inset * 2) / 2
  const center = size / 2
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff"/></svg>`
}

const renderWithBackground = async (size, markScale = 0.62) => {
  const background = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const markSize = Math.round(size * markScale)
  const mark = await sharp(svgBuffer)
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return background
    .composite([
      { input: Buffer.from(circleSvg(size)), left: 0, top: 0 },
      {
        input: mark,
        left: Math.round((size - markSize) / 2),
        top: Math.round((size - markSize) / 2),
      },
    ])
    .png()
    .toBuffer()
}

const windowPng = await renderWithBackground(windowPngSize, 0.62)

await fs.writeFile(path.join(iconDir, 'embers-icon.png'), windowPng)

const icoBuffers = await Promise.all(
  iconSizes.map((size) => renderWithBackground(size, 0.62)),
)

const icoBuffer = await toIco(icoBuffers)
await fs.writeFile(path.join(iconDir, 'embers-icon.ico'), icoBuffer)

console.log('Generated branded icon assets in assets/icons')
