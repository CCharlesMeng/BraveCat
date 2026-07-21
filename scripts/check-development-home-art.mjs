import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const previewRoot = 'public/dev-art/home-v3'
const expectedFiles = {
  'exterior-morning.png': '334cfaa2fd9bbaf3b32d6a1633f157d5eb603153098838e2211ec79ae2b1627d',
  'exterior-noon.png': 'cd1114621d449644d26df321f4fd13d022120c686a94d4bc600bedbf4e356a0e',
  'exterior-dusk.png': '37f0296ede27afd5d24c67e78404ffb8ed148be16fb95e3c17680742ce73f2a2',
  'exterior-late-night.png': '6516099663d76f249c411ea22b498380fe204e0a841d15114cc189bf5e362385',
  'interior-foreground.png': 'b9270731183e8ec70f492926f29d7e83a2a0aaae26cbe2a2ab6598e01be7926d',
  'lighting-morning.png': '00cf38de3fec52d24acfc60c14955f6246609976e696840213e8bb379f04482e',
  'lighting-dusk.png': '1f407ece593d8c5d51414f6dcd3c215255297ce57af77f3bd4d332a4a583230a',
  'lighting-late-night.png': '694f8e33a8c200460b58b57b7a43703cf6a836132eb640f0af24beca68045e23',
}

const sha256 = (contents) => (
  createHash('sha256').update(contents).digest('hex')
)

for (const [filename, expectedHash] of Object.entries(expectedFiles)) {
  const runtimePath = path.join(root, previewRoot, filename)
  const contents = await readFile(runtimePath).catch(() => {
    throw new Error(`${runtimePath} is missing`)
  })
  if (sha256(contents) !== expectedHash) {
    throw new Error(`${runtimePath} does not match its non-shipping candidate`)
  }
}

console.log(
  `verified ${Object.keys(expectedFiles).length} non-shipping development home-art layers`,
)
