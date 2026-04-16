import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { sanitizeAppConfig } from '@main/application/security/tool-path.validation'
import type { AppConfig } from '@shared/domain/app-config'
import { defaultAppConfig } from '@shared/domain/app-config'

const CONFIG_FILENAME = 'cloud-tools.settings.json'

export class AppConfigStore {
  constructor(private readonly userDataDir: string) {}

  private get configPath(): string {
    return join(this.userDataDir, CONFIG_FILENAME)
  }

  ensureUserData(): void {
    if (!existsSync(this.userDataDir)) {
      mkdirSync(this.userDataDir, { recursive: true })
    }
  }

  read(): AppConfig {
    this.ensureUserData()
    try {
      if (!existsSync(this.configPath)) {
        return defaultAppConfig()
      }
      const raw = readFileSync(this.configPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<AppConfig>
      const merged: AppConfig = {
        ...defaultAppConfig(),
        ...parsed
      }
      return sanitizeAppConfig(merged)
    } catch {
      return defaultAppConfig()
    }
  }

  write(partial: Partial<AppConfig>): AppConfig {
    this.ensureUserData()
    const next: AppConfig = sanitizeAppConfig({
      ...this.read(),
      ...partial
    })
    writeFileSync(this.configPath, JSON.stringify(next, null, 2), 'utf8')
    return next
  }
}
