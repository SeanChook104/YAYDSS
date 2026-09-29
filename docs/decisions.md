# Decisions

Newest at the bottom. Format: date – decision – why.

1. **Earlier chat – link-jumping MV3 extension first.** It's safe: it only changes the Discord tab's URL. No bot (the server isn't ours) and no user token (ban risk).
2. **2026-09-29 – Name: YAYDSS, "Yet Another YouTube Discord Sync Scroll".**
3. **2026-09-29 – Two deliverables:** a Chrome + Firefox extension, then a Vencord plugin.
4. **2026-09-29 – Vencord plugin targets the Discord desktop app.** The extension sends ticks to the plugin over a localhost HTTP bridge. A web-Discord `postMessage` bridge is optional, for later.
5. **2026-09-29 – Accepting client-mod risk for the plugin.** Vencord modifies the Discord client, which is against Discord's ToS. It's lower risk than a self-bot, and the user chose it knowingly. The plain extension stays usable without Vencord.
6. **2026-09-29 – Tooling: pnpm workspace, TypeScript, WXT for the extension, vitest.** One codebase builds both Chrome and Firefox. `packages/core` is shared with the plugin.
7. **2026-09-29 – Extension jump style:** URL jump by default, plus an opt-in "soft jump" (`history.pushState` inside the Discord tab, no reload).
8. **2026-09-29 – License: GPL-3.0-or-later for the whole repo.** Vencord plugins must be GPL; one license keeps it simple.
9. **2026-09-29 – Clean-room vs. prior art.** peterrupa/youtube-discord-sync has no license, so we reuse its ideas only.
10. **2026-09-29 – Stream start rule** (`chooseStart`):
    - normal stream → `startTimestamp`
    - premiere or VOD >60 s shorter than the broadcast → `endTimestamp − duration`
    - anything left over → offset / calibrate
    - The 60 s threshold is a guess; tune it with real VODs.
11. **2026-09-29 – Offset sign:** positive = show later chat. Default 0 (the prior art used −3 s).
12. **2026-09-29 – Jump links to computed IDs work.** Tested in a real public channel; details in `testing.md`.
    - Discord loads the messages around the moment and puts it **about mid-screen**.
    - Nothing is highlighted.
    - A future time → newest messages. A time before the channel existed → the top of the channel.
    - So no special handling is needed for gaps, the future, or the past.
    - **Side effect:** the lower half of the screen shows chat from *after* the VOD moment (roughly a minute in a busy stream).
      - The URL mode can't control scrolling, so live with it (or the user sets a negative offset).
      - The Vencord plugin should line the target up with the **bottom** of the chat instead (Phase 4/5).

13. **2026-09-29 – YouTube facts checked on real VODs** (in a browser):
    - `movie_player.getPlayerResponse()` switches to the new video after an in-page click; `ytInitialPlayerResponse` stays on the old one.
    - `yt-navigate-finish` still fires and carries `detail.response.playerResponse`.
    - `liveBroadcastDetails.{startTimestamp,endTimestamp,isLiveNow}` and `videoDetails.isLiveContent` are present.
    - For normal streams, `end − start` and the VOD length differ by only about 1 s. That confirms `startTimestamp` as VOD 0:00, with plenty of room under the 60 s threshold.
    - During a pre-roll ad, `#movie_player` has `.ad-showing` and `<video>.duration` is the ad's length (6 s). So ads must be skipped.

## Test results to record
- [x] **Phase 0 jump test:** where Discord lands for a computed (non-existent) message ID. See decision 12.
- [ ] **Soft jump:** does `pushState` + `popstate` work with Discord's router?
