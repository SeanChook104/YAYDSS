# APIs – what we can and can't use

## Discord

| Option | Usable? | Why |
|---|---|---|
| Bot / Discord API | ❌ | The server is public and not ours, so we can't add a bot. |
| User token / self-bot (DiscordChatExporter-style) | ❌ | Breaks Discord's terms and can get the account banned. |
| **Message links with a computed snowflake** | ✅ (extension v1) | A message ID encodes its creation time, so we can build one for any moment. |
| Vencord internals (`@webpack/common`) | ✅ (plugin, user's choice) | In-app jumps with no reload. Client mod: against Discord's ToS, lower risk than a self-bot. |

### Snowflakes
```
DISCORD_EPOCH = 1420070400000                     // 2015-01-01T00:00:00Z
id = (BigInt(unix_ms) - DISCORD_EPOCH) << 22n     // smallest ID at that moment
unix_ms = Number((BigInt(id) >> 22n) + DISCORD_EPOCH)
```
- Always use `BigInt`: IDs are bigger than `Number.MAX_SAFE_INTEGER`.
- Discord's own docs use timestamp snowflakes for `before`/`after`/`around` paging. Source: https://docs.discord.com/developers/reference (Snowflakes).
- Documented example: `175928847299117063` ↔ `1462015105796` ms.
- Code: `packages/core/src/snowflake.ts`.

### Jump link
`https://discord.com/channels/<guild>/<channel>/<message_id>`
- Hosts: `discord.com`, `ptb.discord.com`, `canary.discord.com` (old: `discordapp.com`).
- **Tested 2026-09-29:** Discord loads the messages around the ID and puts that moment **about mid-screen**, with no highlight.
  - A future ID → newest messages.
  - An ID before the channel existed → the top of the channel.
  - Details in `docs/testing.md`.

### Vencord (plugin only)
From `@webpack/common` (the same functions Vencord's own `quickReply` plugin uses):
- `NavigationRouter.transitionTo("/channels/g/c/m")`: go to a channel or message in-app.
- `MessageActions.jumpToMessage({ channelId, messageId, flash, jumpType: "INSTANT" })`: jump within the channel.
- `MessageStore.getMessages(channelId)._array`: messages already loaded in the user's own client. Only read them to pick a jump target; never store or export them.
- `SelectedChannelStore.getChannelId()`, `ChannelStore`.

Userplugin `native.ts`:
- Runs in Discord desktop's Node process.
- The UI calls it with `VencordNative.pluginHelpers.<Name>`.
- Native code can't push to the UI, so the UI long-polls.
- Example to copy the pattern from: Vencord's `xsOverlay` plugin.

## YouTube

| Source | Gives | Notes |
|---|---|---|
| `document.getElementById("movie_player").getPlayerResponse()` | `videoDetails`, `microformat` | Needs a **MAIN-world** script. Stays fresh after in-page navigation. |
| `ytInitialPlayerResponse` | same | Goes **stale** after in-page navigation. Avoid. |
| `yt-navigate-finish` event | `event.detail.response.playerResponse` | Fires after each in-page navigation. |
| JSON-LD `#microformat script[type="application/ld+json"]` | `publication[0].startDate/endDate/isLiveBroadcast` | Fallback. Used by the prior art. |
| YouTube Data API `videos?part=liveStreamingDetails` | `actualStartTime` | Needs an API key. Not used. |
| Official live chat API | – | ❌ Doesn't return chat for ended streams. |
| yt-dlp / chat-downloader | chat replay | Unofficial scraping, ToS risk. Only for the optional v3. |

Useful fields:
- `microformat.playerMicroformatRenderer.liveBroadcastDetails.startTimestamp`, `.endTimestamp`, `.isLiveNow`
- `videoDetails.isLiveContent`: `true` for streams, `false` for **premieres**. Works in any page language.
- `videoDetails.isPostLiveDvr`: the VOD is still being processed.
- `videoDetails.lengthSeconds`, or `<video>.duration`

### Stream start = VOD 0:00?
- Normal stream: `startTimestamp`.
- Premiere: its start includes the countdown, so use `endTimestamp − duration`.
- Trimmed start, or a stream over 12 h: the VOD is shorter than the broadcast. Use `end − duration` and warn.
- In every case the user can fix leftovers with **offset** or **calibrate**.
- Code: `packages/core/src/youtubeStart.ts`.

### Other YouTube gotchas
- While an ad plays, `<video>.currentTime` is the ad's time. Skip ticks while `#movie_player` has `.ad-showing`.

## Browser extension platform
- **Chrome:** MV3 with a service worker. The worker can be killed at any time, so register listeners at the top level and keep state in `storage.session`.
- **Firefox:** MV3 with `background.scripts` (WXT does this). Needs `browser_specific_settings.gecko.id`. `world: "MAIN"` content scripts need Firefox 128+. New AMO add-ons need `data_collection_permissions`, which needs Firefox 140+ (Android 142+), so our minimum is 140. Users can switch off site access, so the popup checks `permissions.contains` and offers "Allow access".
- **WXT:** builds Firefox as **MV2 unless** `manifestVersion: 3` is set.
- **Localhost bridge:** the background may `fetch("http://127.0.0.1:PORT")` if `http://127.0.0.1/*` is in `host_permissions`, which exempts it from Chrome's Local Network Access prompt. Never make this call from a content script.
