import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const packageDir = path.join(rootDir, 'release', 'Pixcope-win32-x64', 'resources', 'app')

const copies = [
  {
    from: path.join(rootDir, 'node_modules', 'unzipper', 'node_modules', 'bluebird', 'js', 'release'),
    to: path.join(
      packageDir,
      'node_modules',
      'unzipper',
      'node_modules',
      'bluebird',
      'js',
      'release',
    ),
  },
  {
    from: path.join(rootDir, 'node_modules', 'bluebird', 'js', 'release'),
    to: path.join(packageDir, 'node_modules', 'bluebird', 'js', 'release'),
  },
]

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true })
  const entries = await fs.readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath)
    } else {
      await fs.copyFile(sourcePath, destinationPath)
    }
  }
}

for (const item of copies) {
  await copyDirectory(item.from, item.to)
}

console.log('Patched packaged Bluebird release files for Pixcope desktop build.')
