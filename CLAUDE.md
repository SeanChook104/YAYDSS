# CLAUDE.md

Context for Claude Code. Read this first, then the files in `docs/` (start with `docs/roadmap.md`).

## Project in one paragraph

**YAYDSS – Yet Another YouTube Discord Sync Scroll.** It syncs a **public Discord channel's chat** with a **YouTube livestream VOD** (not live streams). While the VOD plays, we work out which real-world moment the video is showing and make Discord jump to the messages sent at that moment. There are two deliverables:
1. A **browser extension** (Chrome + Firefox, MV3, WXT) that jumps a Discord browser tab.
2. A **Vencord plugin** for the **Discord desktop app** that jumps in-app with no reload. It receives the VOD time from the extension over a localhost bridge.

Later goal: show the YouTube chat replay alongside.

## Current status

- ✅ Phase 0 setup: pnpm workspace, git, GPL-3.0-or-later, `docs/`.
- ✅ Phase 0 manual jump test: computed IDs work; the target lands mid-screen with no highlight (`docs/decisions.md` #12).
- ✅ Phase 1: `packages/core`. Pure TS with vitest; all tests pass.
- ✅ Phase 2: WXT extension. Builds for Chrome and Firefox MV3. The user tested it in Chrome: correct time and channel, but every URL jump reloads Discord (expected).
- ✅ Phase 4: the Vencord plugin (`vencord-plugin/`) plus the extension's "Discord desktop" target. It builds, lints and typechecks inside `..\Vencord`, and the local server was tested in Node.
- ✅ The user tested Phase 4 in Discord desktop: in-app jumps with no reload.
- ✅ Firefox: the user tested it in Firefox 156 (temporary add-on) with the Discord desktop target. Min version 140; web-ext lint is clean.
- ▶️ **Next:** pick from Phase 3 (soft jump, calibrate) and Phase 5 (put the target at the bottom of the chat, icons, etc.).

## Key constraints (do not violate)

1. **The Discord server is public and not ours.** We can't add a bot, so the Discord API is unavailable.
2. **No self-bots / user tokens.** Never read Discord through the user's account token (e.g. DiscordChatExporter-style tools). It breaks Discord's terms and risks an account ban.
3. **Don't export or store other people's messages.** We only steer what the user can already see. The Vencord plugin may read already-loaded messages to pick a jump target, but must never save or send them anywhere.
4. **YouTube's official API can't return chat for ended streams.** Chat replay is only possible through unofficial scraping (yt-dlp, chat-downloader). That's a later, optional feature with ToS risk.
5. **Clean-room:** `..\youtube-discord-sync` (peterrupa) has **no license**. Reuse ideas, never copy code.

## Core technique

Discord message IDs (snowflakes) encode their creation time, so we can compute an ID for any moment with no API:

```
DISCORD_EPOCH = 1420070400000
message_id = (BigInt(unix_time_ms) - 1420070400000n) << 22n
real_time_ms = stream_start_ms + vod_current_time_s * 1000 + user_offset_ms   // +offset = later chat
url = https://discord.com/channels/<guild_id>/<channel_id>/<message_id>
```

- All of this lives in `packages/core`. **Use it; don't re-implement it.**
- Always use `BigInt`; snowflakes exceed `Number.MAX_SAFE_INTEGER`.
- **Tested:** Discord loads messages around the ID and puts that moment about mid-screen, with no highlight. A future ID → newest messages; an ID before the channel existed → the channel start.

## Repo layout

```
packages/core/    shared maths: snowflake, time, discordUrl, youtubeStart (chooseStart), policy (decideJump), protocol (Tick)
extension/        WXT project: entrypoints/{background, youtube-main.content (MAIN world), youtube.content, popup/}, utils/{types, storage}
vencord-plugin/   userplugin: src/{index.tsx, native.ts, style.css}. Copied (with core → core/) into ..\Vencord\src\userplugins\yaydss by `pnpm vencord:sync`. A symlink breaks Vencord's tsconfig aliases.
scripts/          jump-url.mjs (manual test helper)
docs/             apis, architecture, decisions, prior-art, roadmap, testing
```

## Commands

- pnpm was installed with `npm i -g pnpm`. Corepack needs admin on this PC. If `pnpm` isn't found in bash, add npm's global folder (`%APPDATA%\npm`) to `PATH`.
- `pnpm test`: vitest in all packages.
- `pnpm typecheck`
- `node scripts/jump-url.mjs "2026-09-01T20:00" "<channel link>"`: prints a jump link.
- `pnpm vencord:sync` / `pnpm vencord:watch`: copy the plugin into `../Vencord`; then `pnpm build` (or `pnpm build --watch`) there.

## Build plan (summary; details in `docs/roadmap.md`)

- **Extension:** URL jump by default (reloads Discord, so ≥60 s between auto jumps), plus an opt-in **soft jump** (`history.pushState` in the Discord tab).
- **Vencord plugin:** chosen by the user even though client mods are against Discord's ToS (lower risk than a self-bot).
  - Uses `MessageActions.jumpToMessage` / `NavigationRouter.transitionTo`.
  - `native.ts` runs an HTTP server on 127.0.0.1 with token + Origin checks; the UI long-polls it.
- **YouTube chat replay (optional):** mention the ToS risk before building.

## Working with this user

- Prefers **concise, task-by-task guidance with specific clicks and steps**, plain language, hands-on learning.
- Prefers brief, direct suggestions over big rewrites. Explain changes in short steps.

## Docs

- `docs/roadmap.md`: phases and checkboxes.
- `docs/apis.md`: what the Discord / YouTube / browser APIs can and can't do.
- `docs/architecture.md`: how the sync works, components, the diagram.
- `docs/prior-art.md`: existing projects worth reading.
- `docs/decisions.md`: decisions made so far and why.
- `docs/testing.md`: manual test steps and checklists.
