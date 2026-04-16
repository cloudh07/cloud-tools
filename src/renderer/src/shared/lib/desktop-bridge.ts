import type { DesktopBridge } from '@shared/domain/desktop-bridge'

export function getDesktop(): DesktopBridge {
  const bridge = window.desktop
  if (!bridge) {
    throw new Error(
      'Desktop bridge is unavailable (window.desktop). The preload script likely failed to load - check the Electron DevTools console.'
    )
  }
  return bridge
}

export async function shellOpenPath(filePath: string): Promise<void> {
  const w = window as Window &
    Partial<Pick<Window, 'shellOpenPath' | 'shellOpenDirectory' | 'shellRevealFile'>> & {
      desktop?: DesktopBridge
    }
  if (typeof w.shellOpenPath === 'function') {
    return w.shellOpenPath(filePath)
  }
  const d = w.desktop
  if (d && typeof d.shellOpenPath === 'function') {
    return d.shellOpenPath(filePath)
  }
  throw new Error(
    'Thiếu API shellOpenPath (preload). Hãy tắt hoàn toàn Cloud Tools rồi chạy lại `pnpm dev` / bản cài đặt mới.'
  )
}

export async function shellOpenDirectory(dirPath: string): Promise<void> {
  const w = window as Window &
    Partial<Pick<Window, 'shellOpenPath' | 'shellOpenDirectory' | 'shellRevealFile'>> & {
      desktop?: DesktopBridge
    }
  if (typeof w.shellOpenDirectory === 'function') {
    return w.shellOpenDirectory(dirPath)
  }
  const d = w.desktop
  if (d && typeof d.shellOpenDirectory === 'function') {
    return d.shellOpenDirectory(dirPath)
  }
  throw new Error(
    'Thiếu API shellOpenDirectory (preload). Hãy khởi động lại ứng dụng sau khi cập nhật.'
  )
}

export async function shellRevealFile(filePath: string): Promise<void> {
  const w = window as Window &
    Partial<Pick<Window, 'shellOpenPath' | 'shellOpenDirectory' | 'shellRevealFile'>> & {
      desktop?: DesktopBridge
    }
  if (typeof w.shellRevealFile === 'function') {
    return w.shellRevealFile(filePath)
  }
  const d = w.desktop
  if (d && typeof d.shellRevealFile === 'function') {
    return d.shellRevealFile(filePath)
  }
  throw new Error(
    'Thiếu API shellRevealFile (preload). Hãy khởi động lại ứng dụng sau khi cập nhật.'
  )
}
