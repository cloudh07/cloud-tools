import type { DesktopBridge } from '@shared/domain/desktop-bridge'

declare global {
  interface Window {
    desktop: DesktopBridge
    shellOpenPath: (filePath: string) => Promise<void>
    shellOpenDirectory: (dirPath: string) => Promise<void>
    shellRevealFile: (filePath: string) => Promise<void>
  }
}

export type { DesktopBridge }
