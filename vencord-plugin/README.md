# YAYDSS Vencord plugin

Makes **Discord desktop** follow a YouTube livestream VOD. The YAYDSS browser extension sends the VOD's real-world time to this plugin, and the plugin jumps the chat inside Discord with no reload.

```
Browser extension ──POST 127.0.0.1:47810/yaydss/v1/tick──► native.ts (Discord's Node side)
                                                              │ long-poll
                                                              ▼
                                                   index.tsx (Discord UI): jumpToMessage / transitionTo
```

> Vencord is a Discord client mod. Client mods are against Discord's ToS (lower risk than self-bots, but not zero).

## Files
- `src/index.tsx`: settings, the chat-bar Follow button, jump logic.
- `src/native.ts`: the 127.0.0.1 HTTP server.
  - Requires the pairing token.
  - Accepts only extension origins.
  - Checks the Host header.
  - Caps bodies at 4 KB.
- `src/style.css`
- `core/` is **not** here. `scripts/sync-vencord.mjs` copies `packages/core/src` in when it copies the plugin.

## Install (Windows, Discord Stable)
Vencord only loads custom plugins from a build you made yourself.

1. Get Vencord's source (once). It sits next to this repo:
   ```
   cd ..
   git clone https://github.com/Vendicated/Vencord
   cd Vencord
   pnpm install --frozen-lockfile
   ```
2. Copy the plugin in, then build (from the YAYDSS folder):
   ```
   pnpm vencord:sync
   cd ../Vencord
   pnpm build
   ```
3. Quit Discord completely (tray icon → **Quit Discord**).
4. In the Vencord folder, run `pnpm inject`. Pick **Discord Stable** → **Install** (or "Repair"). Your Vencord settings and plugins are kept.
5. Open Discord → **User Settings → Vencord → Plugins**. Search **YAYDSS** and switch it on.
6. Click the ⚙ on YAYDSS and copy the **Pairing token**.

## Develop
- Terminal 1 (YAYDSS): `pnpm vencord:watch` copies on every save.
- Terminal 2 (Vencord): `pnpm build --watch`.
- Then in Discord:
  - **Ctrl+R** reloads `index.tsx` changes.
  - Changes to **`native.ts` need a full Discord restart**.
- After a Discord update removes Vencord, run `pnpm inject` again.
