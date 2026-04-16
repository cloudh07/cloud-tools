export type FolderDropScanResult = {
  folderPath: string
  folderName: string
  fileCount: number
  totalBytes: number
  truncated: boolean
  extensionCounts: Record<string, number>
}
