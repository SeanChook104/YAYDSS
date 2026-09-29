# Architecture

## The idea
```
real_ms    = stream_start_ms + vod_time_s * 1000 + offset_ms
message_id = (BigInt(real_ms) - 1420070400000n) << 22n
```
Tell Discord to show `message_id` in the chosen channel. Discord loads the messages around that moment.

## Pieces
```
┌──────────────── Browser ────────────────────────────────────────────┐
│                                                                     │
│  YouTube tab                                                        │
│   ├─ youtube-main.content.ts  (MAIN world)                          │
│   │    getPlayerResponse() → broadcast facts ──postMessage──┐       │
│   └─ youtube.content.ts       (isolated)                    ▼       │
│        <video> play/pause/seeked + 5 s heartbeat ── runtime.sendMessage
│                                                             │       │
│  background.ts (service worker / event page)  ◄─────────────┘       │
│   chooseStart → realMs → snowflakeFromMs → decideJump → driver:     │
│     • url     : tabs.update(discordTab, jump link)   (reloads)      │
│     • soft    : discord-main.content.ts pushState    (experimental) │
│     • vencord : fetch POST 127.0.0.1:PORT/yaydss/v1/tick ──┐        │
│                                                            │        │
│  popup: channel link, offset, calibrate, auto, Sync now    │        │
└────────────────────────────────────────────────────────────┼────────┘
                                                             │ localhost
┌──────────── Discord desktop app (Vencord) ─────────────────┼────────┐
│  native.ts (Node): http server on 127.0.0.1, token check ◄─┘        │
│      ▲ long-poll waitForTick()                                      │
│  index.tsx (UI): jumpToMessage / NavigationRouter.transitionTo      │
│                  chat-bar "Follow" toggle                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Shared code
`packages/core` holds pure TypeScript with no dependencies, so the extension and the plugin run the same maths:

| File | Job |
|---|---|
| `snowflake.ts` | ms ↔ snowflake (BigInt) |
| `time.ts` | `realMs`, `offsetFromCalibration` |
| `discordUrl.ts` | parse channel/message links, build jump links and paths |
| `youtubeStart.ts` | `chooseStart`: which timestamp is VOD 0:00 |
| `policy.ts` | `decideJump`: when to jump (manual / seek / interval, per-mode rate limits) |
| `protocol.ts` | `Tick` message format for the Vencord bridge, `isTick` validator |

- The extension imports it as a workspace package (`@yaydss/core`).
- Vencord gets a **copy** made by `scripts/sync-vencord.mjs`. A symlink breaks Vencord's tsconfig path aliases.

## When to jump
`decideJump` rules:
- **Manual** ("Sync now" or the shortcut): always.
- **Paused, or auto off:** never automatically.
- **Seek / play:** only if the target moved more than 15 s.
- **Interval:** at least 60 s apart (url), 10 s (soft) or 5 s (vencord). URL jumps reload Discord, so keep them rare.

## Privacy / safety rules
- The extension never reads Discord messages.
- The plugin only reads messages already loaded in the user's own client, to pick a jump target. It never stores or sends them anywhere.
- Stored data:
  - channel IDs
  - per-video offsets
  - the pairing token
- The localhost server:
  - binds to `127.0.0.1` only
  - requires `Authorization: Bearer <token>`
  - only accepts `chrome-extension://` / `moz-extension://` origins
  - sends no CORS headers and caps bodies at 4 KB
