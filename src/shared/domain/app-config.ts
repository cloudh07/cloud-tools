export type AppConfig = {
  ffmpegPath: string
  ffprobePath: string
}

export const defaultAppConfig = (): AppConfig => ({
  ffmpegPath: 'ffmpeg',
  ffprobePath: ''
})
