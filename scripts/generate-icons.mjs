import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const buildDirectory = resolve('build')
const source = await readFile(resolve(buildDirectory, 'icon-source.svg'))
await mkdir(buildDirectory, { recursive: true })

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer())
)

await Promise.all([
  writeFile(resolve(buildDirectory, 'icon.png'), pngBuffers.at(-1)),
  writeFile(resolve(buildDirectory, 'tray.png'), pngBuffers[2]),
  pngToIco(pngBuffers).then((icon) => writeFile(resolve(buildDirectory, 'icon.ico'), icon))
])
