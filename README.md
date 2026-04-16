# Cloud Tools

Windows-friendly Electron toolbox built with [electron-vite](https://electron-vite.org/), React 19, TypeScript, Tailwind CSS v4, and shadcn-style UI primitives (Radix).

## Prerequisites

- Node.js 22+ recommended
- [pnpm](https://pnpm.io/) 9+
- `ffmpeg` and `ffprobe` available on `PATH`, or configure absolute paths in the in-app **Settings** screen

## Install

```bash
pnpm install
```

## Develop

```bash
pnpm dev
```

This starts the electron-vite dev server with renderer HMR.

## Build (electron-vite)

The repo follows the usual [electron-vite build flow](https://electron-vite.org/guide/build): compile main, preload, and renderer into `out/`.

```bash
pnpm build
```

This runs `pnpm typecheck` then `electron-vite build` (see `package.json`). Preview the production bundle with `pnpm start` (electron-vite preview).

**Preload + sandbox:** the preload script only uses `require('electron')` after bundling (no external `@electron-toolkit/preload` dependency), so it loads correctly with `sandbox: true`.

**IPC hardening:** video job payloads are validated with Zod (UUID job id, bounded numeric params, enums). At most two ffmpeg jobs run concurrently. `ffmpeg` / `ffprobe` paths are sanitized on save and when reading settings from disk.

## Typecheck / lint

```bash
pnpm typecheck
pnpm lint
```

## Build (Windows)

```bash
pnpm build:win
```

Artifacts are produced by `electron-builder` according to `electron-builder.yml`.

## ffmpeg configuration

The app persists settings to:

`%APPDATA%\\cloud-tools\\cloud-tools.settings.json` (name follows your `package.json` `name` on Windows)

You can mirror that file using `config/ffmpeg.settings.example.json` as a template.

## Architecture (short)

- `src/shared`: cross-layer types, IPC channel names, and pure ffmpeg argument builders
- `src/main`: Electron main, IPC, filesystem validation, ffprobe, ffmpeg job runner
- `src/preload`: small, typed `contextBridge` surface (`window.desktop`)
- `src/renderer/src`: feature modules + layered folders (`presentation`, `application`, `features`)

## Video tool notes

This MVP implements a **classic chroma key** workflow: you provide the RGB key color to remove (for example a green screen). It does **not** perform AI matting for arbitrary backgrounds.

**Preview playback:** the renderer loads from Vite `http(s)` while the file lives on disk. Raw `file://` URLs are often blocked in that setup, so the main process registers a privileged **`local-media:`** protocol (`local-media://127.0.0.1/p/<hex>`) that streams the picked `.mp4` after path validation. Chroma job / UI state is **not** persisted with `zustand/persist` (only in-memory); settings use the JSON file above.

Outputs:

- **Greenscreen plate**: H.264 MP4 with keyed pixels composited onto a solid chroma-green plate
- **Alpha**: ProRes 4444 MOV (`yuva444p10le`) for transparent workflows on Windows timelines

Optional **WebP** export runs as a second ffmpeg pass from the intermediate file.

## Future upgrades

- Segmentation / AI background removal for non-studio footage
- Hardware encoding (NVENC / QSV) presets
- Presets persisted per tool and project files
- Automated tests around ffmpeg graph building and progress parsing
=======
# cloud-tools
>>>>>>> cc1027f0504c4eea819d12ae222fe42e91435930
