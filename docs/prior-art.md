# Prior art

## peterrupa/youtube-discord-sync ("Discord Time Machine")
https://github.com/peterrupa/youtube-discord-sync (local clone: `..\youtube-discord-sync`)

**⚠️ No license = all rights reserved. YAYDSS is a clean-room rewrite: we reuse ideas, never code.**

What it is:
- Chrome-only MV3 extension, active 2023–2026.
- Plain JS content scripts plus a React/Vite/Tailwind popup.

How it works:
- **Stream start:** JSON-LD `#microformat script[type="application/ld+json"]` → `publication[0].startDate` / `endDate`.
  - Premieres use `endDate − video.duration`, detected by the English word "Premiered".
  - A code comment says `end − duration` ran late for normal livestreams, so those use `startDate`.
- **Time:** the `<video class="video-stream">` `timeupdate` event. Default offset 3 s (subtracted).
- **Messaging:** YouTube content script → service worker relay keyed by tabId → Discord content script. State is kept in memory only, so a refresh loses it.
- **Discord side:** scrolls the page DOM.
  - Finds `main div[class*='scroller'] time[datetime]` and picks the last message older than the target.
  - Scrolls using hardcoded pixel numbers.
  - If the target isn't loaded, it scrolls up one screen per tick, which is slow for big jumps.
  - These selectors broke twice after Discord redesigns.

Ideas we keep:
- start/end + duration for premieres
- the tick relay through the background
- the offset setting
- the popup tab picker
- MutationObserver / navigation handling

What we do differently:
- snowflake jump links instead of DOM scrolling
- the language-independent premiere check (`isLiveContent`)
- Firefox support
- state that survives reloads (`storage`)
- a Vencord plugin for in-app jumps

## Reference code inside Vencord (GPL-3.0)
https://github.com/Vendicated/Vencord
- `src/plugins/quickReply/index.ts`: `MessageActions.jumpToMessage`, `MessageStore`, `SelectedChannelStore` usage.
- `src/plugins/xsOverlay/`: `native.ts` pattern (lazy init, `VencordNative.pluginHelpers`).
- `src/webpack/common/utils.ts`: `NavigationRouter.transitionTo`.
- Custom plugin install guide: https://docs.vencord.dev/installing/custom-plugins/

## Things we deliberately don't use
- **DiscordChatExporter** and other token-based tools: self-bot, against Discord's terms.
- **yt-dlp / chat-downloader** for YouTube chat replay: maybe later (v3), with a ToS warning.
