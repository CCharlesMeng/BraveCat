import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim()
if (dirty) throw new Error('Commit the reviewed source before packaging a traceable release candidate')
const dist = path.join(root, 'apps/web/dist')
const files = []
const visit = async (relative = '') => {
  for (const entry of await readdir(path.join(dist, relative), { withFileTypes: true })) {
    const file = path.posix.join(relative, entry.name)
    if (entry.isDirectory()) await visit(file)
    else if (entry.isFile()) {
      const bytes = await readFile(path.join(dist, file))
      files.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
  }
}
await visit()
files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
for (const required of ['index.html', 'sw.js', 'manifest.webmanifest']) {
  if (!files.some(file => file.path === required)) throw new Error(`Build first: missing ${required}`)
}
const output = path.join(root, '.asset-publish', `web-pwa-rc-${commit.slice(0, 12)}`)
await mkdir(output, { recursive: true })
const archive = path.join(output, 'web-pwa.tar.gz')
execFileSync('tar', ['-czf', archive, '-C', dist, '.'])
const bytes = await readFile(archive)
const manifest = {
  commit, status: 'candidate-not-for-public-launch',
  archive: 'web-pwa.tar.gz', sha256: createHash('sha256').update(bytes).digest('hex'),
  assetOrigin: 'same-origin', saveSchemaVersion: 5, localOnly: true,
  pending: ['functional gaps recorded in docs/audits/web-pwa-functional-gaps-2026-09-29.md', 'real mobile installation and system sharing acceptance', 'production HTTPS host and domain'],
  files,
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Reviewable Web/PWA candidate: ${output}`)
console.log(`Archive SHA-256: ${manifest.sha256}`)
