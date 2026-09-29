# Roadmap

Tick items off as they land.

## Phase 0 – Setup ✅
- [x] pnpm workspace, git, GPL-3.0 license, docs
- [x] **Manual jump test**: works; the target lands mid-screen with no highlight (`decisions.md` #12)

## Phase 1 – `packages/core` ✅
- [x] `snowflake`, `time`, `discordUrl`, `youtubeStart`, `policy`, `protocol`, plus vitest tests

## Phase 2 – Extension MVP (Chrome first)
- [ ] Create the project: `pnpm dlx wxt@latest init extension` (vanilla).
- [ ] Settings in `wxt.config.ts`:
  - `manifestVersion: 3`
  - hosts: `https://www.youtube.com/*`, `https://*.discord.com/*`
  - permissions: `storage`
  - a `sync-now` command
  - Firefox only: `gecko` id, `strict_min_version: "128.0"`, `data_collection_permissions`
- [ ] `youtube-main.content.ts` (MAIN world): `getPlayerResponse()` + `yt-navigate-finish`, then `postMessage` the broadcast facts.
- [ ] `youtube.content.ts`: `<video>` events + 5 s heartbeat, skip ads, JSON-LD fallback, send to the background.
- [ ] `background.ts`: top-level listeners, `storage.session` tab links, `chooseStart → realMs → snowflakeFromMs → decideJump`, URL driver (`tabs.update`).
- [ ] Popup:
  - status
  - channel link / "use current Discord tab"
  - offset ±1/±5
  - auto toggle
  - Sync now
  - per-video memory

## Phase 3 – Firefox + polish
- [ ] `pnpm dev:firefox`, then load via `about:debugging` and check that `world: "MAIN"` made it into the manifest.
- [ ] Soft jump, experimental and off by default. Test it in the console first.
- [ ] Calibrate from a pasted message link.
- [ ] Badge, GitHub Actions (tests + both builds), `wxt zip`.

## Phase 4 – Vencord plugin (Discord desktop)
- [ ] Clone Vencord to `..\Vencord` and run `pnpm i --frozen-lockfile`.
- [ ] `scripts/sync-vencord.mjs` copies the plugin + core into `src/userplugins/yaydss/`.
- [ ] `index.tsx`:
  - `name: "YAYDSS"` must be the first property
  - settings, chat-bar Follow toggle, toolbox "Copy pairing token"
  - `handleTick` → `jumpToMessage` / `transitionTo`
- [ ] `native.ts`:
  - 127.0.0.1 HTTP server with token + Origin checks
  - `waitForTick` long-poll
  - no work done at load time
- [ ] Extension: `http://127.0.0.1/*` host permission, pairing form, `fetch` driver.
- [ ] Later: a web-Discord `postMessage` bridge.

## Phase 5 – Later / optional
- Line up the target message with the bottom of the chat. URL jumps put it mid-screen, which shows about a minute of "future" chat in busy streams.
- Live mode.
- YouTube chat replay (ToS risk).
- Chrome Web Store / AMO listings.
- Submit the plugin to Vencord.
