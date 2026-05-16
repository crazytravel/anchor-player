# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anchor Player is a high-fidelity desktop music player built with Tauri 2 (Rust backend) and React 19 (TypeScript frontend). It uses Symphonia for audio decoding and supports lossless formats (FLAC, WAV, OGG, AIFF, ALAC) and lossy formats (MP3, AAC, M4A, WMA, etc.).

## Development Commands

```bash
# Run in development mode (starts both Vite dev server and Tauri app)
pnpm tauri dev

# Build for production
pnpm tauri build

# Frontend only (no Tauri shell)
pnpm dev          # Vite dev server on port 1420
pnpm build        # TypeScript check + Vite build

# Rust backend only
cd src-tauri
cargo build
cargo clippy
cargo fmt
```

## Architecture

### Frontend (src/)
Single-page React 19 app using Zustand 5 for state management and Tailwind CSS v4 (CSS-first configuration via `@import "tailwindcss"` in `index.css`). The main UI lives in `App.tsx` — playlist panel on the left, album art and controls on the right. Communication with the Rust backend happens via Tauri's `invoke()` for commands and `listen()` for events.

- `App.tsx` — Main UI component with player controls, playlist, and album art display
- `App.css` — Component-level styles including GPU-accelerated blur background (`.bg-blur`)
- `store.ts` — Zustand store holding all player state (active track, play/pause, volume, playlist, sequence type)
- `declare.ts` — TypeScript interfaces shared between frontend logic (mirrors Rust structs)
- `constants.ts` — Supported audio formats and sequence type enums
- `icon.tsx` — SVG icon components
- `info.tsx` — Track info modal component
- `setting.tsx` — Settings modal component
- `components/message.tsx` — Error/notification message component
- `components/modal.tsx` — Reusable modal component

### Backend (src-tauri/src/)
Rust Tauri application handling audio playback, file I/O, and persistent storage.

- `lib.rs` — Tauri command handlers and app setup. All IPC commands are defined here (`play`, `pause`, `seek`, `play_next`, `play_previous`, `switch`, `playlist_add`, etc.). Play-state emission is throttled to max 4/sec (250ms intervals) to prevent frontend flooding.
- `player.rs` — Core audio playback using Symphonia for decoding. Handles seek, metadata extraction, and play-state emission
- `output/` — Platform-specific audio output (cpal on macOS/Windows via `default.rs`, PulseAudio on Linux via `linux.rs`)
- `resampler.rs` — Audio resampling using rubato (non-Linux only)
- `music.rs` — Domain types: `MusicFile`, `MusicInfo`, `PlayState`, `MusicSetting`, `MusicError`
- `state.rs` — Tauri managed state types (`IdState`, `PauseState`, `VolumeState`, `MusicFilesState`, etc.)
- `store.rs` — Persistent storage via `tauri-plugin-store` (playlist, settings, play position)
- `cache.rs` — Album art cache management (stored in app cache directory)
- `file_reader.rs` — Directory traversal for supported audio files

### Communication Pattern
The backend emits events to the frontend: `play-state` (progress updates, throttled to 4Hz), `music-info` (codec details), `music_data_completion` (metadata cache ready), `paused-action` (pause/resume coordination), `error`, `finished`. The frontend sends commands via `invoke()`.

### Playback State Machine
Playback coordination uses a pause-state pattern: when the user seeks or switches tracks while playing, the backend sets `PauseState` with an `EventSource` (Play/PlayNext/PlayPrev/Pause) and a payload. The frontend receives the `paused-action` event and calls `pause_action` to resume from the new position.

## Key Dependencies

### Frontend
- React 19, React DOM 19
- Zustand 5 (state management)
- Tailwind CSS 4 with `@tailwindcss/postcss` (no tailwind.config.js — CSS-first config)
- Vite 8, TypeScript 6
- Tauri API v2 and plugins (dialog, global-shortcut, http, opener, store)

### Backend (Rust)
- Tauri 2.3
- Symphonia 0.5.4 (audio decoding, all codecs enabled with SIMD)
- cpal 0.13 (audio output on macOS/Windows)
- rubato 0.12 (resampling, non-Linux)
- libpulse-binding 2.5 (audio output on Linux)
- uuid, md5, urlencoding, chrono, base64 (utilities)

## Platform Notes

- macOS: Uses cpal for audio output, app hides to dock on close (not quit)
- Linux: Uses PulseAudio bindings (`libpulse-binding`)
- Windows: Uses cpal (same as macOS)
- Global shortcuts: Cmd/Ctrl+F7/F8/F9 for prev/play/next, Cmd/Ctrl+F10/F11/F12 for mute/vol-down/vol-up, plus media keys

## Tauri Plugins Used

- `tauri-plugin-store` — Persistent JSON storage for playlist, settings, play state
- `tauri-plugin-dialog` — Native file/folder picker
- `tauri-plugin-global-shortcut` — System-wide keyboard shortcuts
- `tauri-plugin-http` — HTTP client (for metadata fetching)
- `tauri-plugin-opener` — OS default app opener

## Performance Notes

- Play-state IPC events are throttled to 250ms intervals (4Hz) to avoid flooding the JS bridge during audio playback
- Album art blur effect uses GPU compositor layer promotion (`will-change: transform`, `transform: translateZ(0)`) via the `.bg-blur` CSS class to avoid re-rasterization on React re-renders
