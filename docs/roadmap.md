# Roadmap

Tick items off as they land.

## Phase 0 – Setup ✅
- [x] pnpm workspace, git, GPL-3.0 license, docs
- [x] **Manual jump test**: works; the target lands mid-screen with no highlight (`decisions.md` #12)

## Phase 1 – `packages/core` ✅
- [x] `snowflake`, `time`, `discordUrl`, `youtubeStart`, `policy`, `protocol`, plus vitest tests

## Phase 2 – Extension MVP (Chrome first)
- [x] Create the project: `pnpm dlx wxt@latest init extension` (vanilla).
- [x] Settings in `wxt.config.ts`:
  - `manifestVersion: 3`
  - hosts: `https://www.youtube.com/*`, `https://*.discord.com/*`
  - permissions: `storage`
  - a `sync-now` command
  - Firefox only: `gecko` id, `strict_min_version: "140.0"`, `data_collection_permissions`
- [x] `youtube-main.content.ts` (MAIN world): `getPlayerResponse()` + `yt-navigate-finish`, then `postMessage` the broadcast facts.
- [x] `youtube.content.ts`: `<video>` events + heartbeat (now 2 s), skip ads, JSON-LD fallback, send to the background.
- [x] `background.ts`: top-level listeners, `storage.session` tab links, `chooseStart → realMs → snowflakeFromMs → decideJump`, URL driver (`tabs.update`).
- [x] Popup:
  - status
  - channel link / "use current Discord tab"
  - offset ±1/±5
  - auto toggle
  - Sync now
  - per-video memory
- [x] **Manual test in Chrome**: VOD detected, Sync now jumps to the right time and channel. Every jump reloads the Discord tab, as expected for URL mode.
- [ ] Replace the placeholder WXT icons

## Phase 3 – Firefox + polish
- [x] Firefox build: `world: "MAIN"` and `background.scripts` are in the manifest; `web-ext lint` gives 0 errors and 0 warnings (min version raised to 140 for `data_collection_permissions`); the popup offers "Allow access" if site access is off.
- [x] **Manual test in Firefox 156** (temporary add-on): works with the Discord desktop target
- [ ] Soft jump, experimental and off by default. Test it in the console first.
- [ ] Calibrate from a pasted message link.
- [ ] Badge, GitHub Actions (tests + both builds), `wxt zip`.

## Phase 4 – Vencord plugin (Discord desktop)
- [x] Clone Vencord to `..\Vencord` and run `pnpm i --frozen-lockfile`.
- [x] `scripts/sync-vencord.mjs` (`pnpm vencord:sync` / `vencord:watch`) copies the plugin + core into `src/userplugins/yaydss/`, adding Vencord's license header.
- [x] `index.tsx`:
  - `name: "YAYDSS"` is the first property
  - settings (follow, flash, port, token), chat-bar Follow toggle, toolbox actions
  - `handleTick`:
    - jumps to the newest *loaded* message ≤ target with `jumpToMessage`; otherwise `transitionTo` the computed ID
    - automatic ticks don't pull you out of another channel
- [x] `native.ts`:
  - 127.0.0.1 HTTP server with token, Origin and Host checks
  - `waitForTick` long-poll
  - no work done at load time
  - tested in Node: 200 / 401 / 403 / 400, long-poll, port in use
- [x] Vencord's `testTsc` and eslint pass on the plugin; it's in `pnpm build`.
- [x] Extension:
  - `http://127.0.0.1/*` host permission
  - "Send to: Discord desktop" + port/token/Test in the popup
  - `fetch` driver
  - heartbeat 2 s, vencord interval 1.5 s
- [x] **Manual test:** `pnpm inject`, enable the plugin, pair, sync: works in Discord desktop with no reload
- [ ] Later: a web-Discord `postMessage` bridge.

## Phase 5 – Later / optional
- [x] Line up the target message with the bottom of the chat (Vencord plugin, Position = Bottom, smooth scroll). URL jumps still put it mid-screen. Tested by the user in Discord desktop.
- Live mode.
- YouTube chat replay (ToS risk).
- Chrome Web Store / AMO listings.
- Submit the plugin to Vencord.

## Phase 6 – Beyond YouTube (2026-10)
- [x] **Local video files** (extension):
  - `file.content.ts` watches the `<video>` in a `file://` tab; the shared watcher is in `utils/watchVideo.ts`.
  - Popup "Line up with the YouTube stream": one moment in both → the file's 0:00 real time, saved per file name.
  - The background fetches the YouTube page and reads its stream start with `parseWatchPage`.
  - Chrome needs "Allow access to file URLs".
- [x] **Plugin clock** (Vencord): the chat keeps moving between ticks and without the extension.
  - Chat-bar ▶/⏸ with a right-click menu (±5 s / ±30 s, Follow, Stop).
  - Right-click a message → "start clock here" / "play from here".
  - Ticks carry `playing`; the extension tells the plugin about pauses and seeks while paused.
- [x] Plugin uses Vencord's new `showToast({ text, variant })` API (Vencord changed it on 2026-10-14).
- [x] **Manual test** by the user: concert file + line-up, and clock mode: both work.
