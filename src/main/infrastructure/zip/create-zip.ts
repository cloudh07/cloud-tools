import { ZipArchive } from 'archiver'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, dirname } from 'path'

export async function createZipFromFiles(params: {
  zipPath: string
  filePaths: string[]
  mapName?: (filePath: string) => string
}): Promise<void> {
  await mkdir(dirname(params.zipPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(params.zipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('warning', (err) => {
      reject(err)
    })
    archive.on('error', reject)

    archive.pipe(output)

    for (const p of params.filePaths) {
      archive.file(p, { name: params.mapName ? params.mapName(p) : basename(p) })
    }

    void archive.finalize()
  })
}
