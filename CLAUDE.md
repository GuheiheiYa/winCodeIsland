# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe Notch is a Windows desktop app inspired by macOS Dynamic Island. It monitors AI assistant terminal sessions (Claude Code, Codex, Gemini) by floating a pill-shaped bar at the screen edge that expands into a full panel on click.

**Tech stack**: Electron 28 + Vue 3 (Composition API / `<script setup>`) + TypeScript 5 + Pinia + Vite + electron-vite.

## Common Commands

```bash
# Development (starts Electron + Vite dev server)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Type check (no emit)
npm run typecheck

# No test runner or linter is configured in this project.
```

## High-Level Architecture

### Process Boundary

The app splits cleanly across the Electron process boundary:

- **`electron/`** — Main process. Owns the native window (`NotchWindowManager`), system tray (`TrayManager`), and IPC handlers (`ipcHandlers.ts`). The main process is the source of truth for window bounds, dock position, and session data (eventually via node-pty; currently mock data in dev mode).
- **`src/`** — Renderer process. Pure Vue frontend. Reads/writes state through `window.electronAPI` (exposed via `preload.ts`). Never uses Node APIs directly.

**Data flow**: Main process pushes session updates over IPC `sessions:update` → Pinia store (`notchStore.ts`) → Vue components reactively re-render. Renderer can request window changes (expand, dock, etc.) via IPC channels back to main.

### Two UI Modes

The entire UI is either **Collapsed** or **Expanded**, managed by `App.vue` conditional rendering:

1. **CollapsedBar** (`src/components/CollapsedBar.vue`) — A 300x36px pill bar.
   - Left side: a Canvas 2D pixel octopus mascot driven by `CanvasRenderer` (`src/renderer/canvas/canvas-renderer.ts`).
   - The mascot has three scenes: `idle` (sleeping + Zzz), `processing` (bouncing + typing), `waitingApproval` (jumping + alert bang).
   - Status text, color, and glow effects are derived from the same mascot state.
   - The current code uses a polling cycle (`setInterval` every 3s) to rotate through all three mascot states for demonstration.

2. **ExpandedPanel** (`src/components/ExpandedPanel.vue`) — A 560px-wide panel that opens from the collapsed bar.
   - Displays sessions grouped by `agentType` (Claude / Codex / Gemini) using `AgentGroup` and `SessionCard`.
   - TopBar provides ALL/STA/CLI tabs that filter by session status.

### Canvas Rendering Engine

Located in `src/renderer/canvas/`. This is a custom 2D sprite engine, not a generic canvas library:

- **`canvas-renderer.ts`** — `CanvasRenderer` class owns a canvas, runs an rAF loop, and routes to one of three scene renderers based on a `getStatus()` callback.
- **`sprites.ts`** — Defines the octopus geometry in SVG-unit space with viewport mapping (`createViewportMapper`) so the same scene renders correctly at any canvas size. Also contains rotation math for arms (`armPath`).
- **`animations.ts`** — Spring physics (`springValue`) and keyframe interpolation (`lerpKeyframes`) used by the alert scene. Also includes `SpringAnimator` for one-shot spring animations (currently unused in the active UI).

**Key detail**: The renderer's `startLoop(getStatus)` accepts a callback that is invoked every frame. This is how CollapsedBar wires the mascot status into the canvas — changing the returned status instantly switches the rendered scene on the next frame.

### State Management

`useNotchStore` (Pinia, `src/stores/notchStore.ts`) is the single source of truth in the renderer:

- `sessions` — array of `Session` objects, updated via IPC from main.
- `isExpanded` / `activeTab` / `dockPosition` — UI state.
- `groupedByAgent` — computed getter that groups sessions by `agentType` in fixed order (Claude → Codex → Gemini), filtering out empty groups.
- `filteredSessions` — respects `activeTab`: ALL = all, STA = sleeping/thinking, CLI = working.

### Session Data Model

```typescript
type SessionStatus = 'working' | 'sleeping' | 'thinking'
type AgentType = 'claude' | 'codex' | 'gemini'
type TerminalType = 'ghostty' | 'iterm2'

interface Session {
  id: string
  projectName: string
  sessionNumber?: string
  agentType: AgentType
  terminalType: TerminalType
  status: SessionStatus
  lastOutput: OutputLine[]
  timestamp: number
  relativeTime: string
}
```

`OutputLine` supports `command | output | thinking | link | prompt` types with optional `linkUrl`.

### Window & Input

`NotchWindowManager` (`electron/windows/notchWindow.ts`) handles:
- Frameless, always-on-top, transparent, skip-taskbar window creation.
- Drag-to-move via IPC messages from renderer (`drag-start`, `drag-move`, `drag-end`).
- Edge snapping on drag-end (40px threshold).
- Bounds animation between collapsed (300x36) and expanded (560x680, max 85vh) states.

### IPC Events (Summary)

| Direction | Key Channels |
|-----------|-------------|
| Renderer → Main | `window:toggle-expand`, `window:set-expanded`, `window:dock`, `settings:set`, `app:quit` |
| Main → Renderer | `window:expand-changed`, `sessions:update`, `settings:changed` |

The preload script (`electron/preload.ts`) exposes a typed `window.electronAPI` so renderer code uses that instead of raw `ipcRenderer`.
