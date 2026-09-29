# YAYDSS Vencord plugin

Makes **Discord desktop** follow a YouTube livestream VOD. The YAYDSS browser extension sends the VOD's real-world time to this plugin, and the plugin scrolls the chat inside Discord with no reload.

**Install and usage steps are in the [main README](../README.md#3-optional-install-the-vencord-plugin-for-discord-desktop).** This page is for development.

```
Browser extension ──POST 127.0.0.1:47810/yaydss/v1/tick──► native.ts (Discord's Node side)
                                                              │ long-poll (waitForTick)
                                                              ▼
                                        index.tsx (Discord UI): scroll / jumpToMessage / transitionTo
```

> Vencord is a Discord client mod. Client mods are against Discord's ToS (lower risk than self-bots, but not zero).

## Files
- `src/native.ts`: the 127.0.0.1 HTTP server.
  - Requires the pairing token.
  - Accepts only extension origins.
  - Checks the Host header.
  - Caps bodies at 4 KB.
  - Starts nothing until `startServer`.
- `src/index.tsx`: settings, the chat-bar Follow button, and what happens on each tick:
  1. Find the newest **loaded** message sent at or before the VOD moment (from `MessageStore`, using the time in each ID).
  2. **Position = Bottom:** scroll the chat so that message's bottom sits at the bottom of the view, or on top of the "viewing older messages" bar when it's there. The message is found by its element id `chat-messages-<channel>-<message>`, not by Discord's class names.
  3. If that message isn't loaded or rendered, let Discord jump first (`jumpToMessage`, or `NavigationRouter.transitionTo` with the computed ID), then line it up once it has rendered.
  4. Automatic ticks only act while you're in the synced channel. Ticks for the same moment leave your scrolling alone.
- `src/style.css`
- `core/` is **not** in this folder. `scripts/sync-vencord.mjs` copies `packages/core/src` in (with Vencord's license header) every time it copies the plugin.

## Develop
- Terminal 1 (YAYDSS): `pnpm vencord:watch` copies on every save.
- Terminal 2 (Vencord): `pnpm build --watch`.
- Then in Discord:
  - **Ctrl+R** reloads `index.tsx` changes.
  - Changes to **`native.ts` need a full Discord restart**.
- Checks (in the Vencord folder):
  - `pnpm exec eslint src/userplugins/yaydss`
  - `pnpm testTsc`
- After a Discord update removes Vencord: quit Discord, then run `pnpm inject` again.
