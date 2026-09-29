# Testing

## Automated
```
pnpm test          # all packages (vitest)
pnpm typecheck
```

## Phase 0 – manual jump test (do this before building the extension)
1. In Discord (browser), open the public channel. Right-click the channel name → **Copy Link**.
2. Pick a moment, then print its jump link:
   ```
   node scripts/jump-url.mjs "2026-09-01T20:00" "<channel link>"
   ```
   The time is read as your local time.
3. Paste the link into the address bar and note what happens.

| Case | Time you used | Where did it land? | Anything highlighted? |
|---|---|---|---|
| Busy moment (many messages) | | | |
| Quiet moment (no messages for a while) | | | |
| In the future | | | |
| Before the channel existed | | | |

Then copy the results into `decisions.md`.

### Results – 2026-09-29 (public channel, discord.com in the browser)
| Case | Time used (local) | Where it landed | Highlight? |
|---|---|---|---|
| Busy (live stream) | 2026-09-25 19:50 | Target moment **about mid-screen**: 19:49 messages above, 19:50 messages from the middle down | No |
| Quiet (no messages for days) | 2026-09-01 20:00 | Last message before the gap (08-31 19:39) near the top, then the "September 4" divider and the next messages below | No |
| Future | 2026-09-30 19:50 | Newest messages, scrolled to the bottom (same as "Jump to Present") | No |
| Before the channel | 2022 | Top of the channel ("Welcome to #…", first message 2023-09-25) | No |

A "You're viewing older messages" bar shows in every case except the future one.

## Soft-jump check (before Phase 3 step 2)
In the Discord tab, open DevTools (F12) → Console and run the code below. Replace the path with one from `jump-url.mjs`, without the `https://discord.com` part.
```js
history.pushState(null, "", "/channels/<guild>/<channel>/<message_id>");
dispatchEvent(new PopStateEvent("popstate", { state: null }));
```
Did Discord move to that moment without reloading?

## Extension checklist (Phase 2/3)
Run each item in Chrome, then again in Firefox 128+.
- [ ] Normal livestream VOD: Discord shows the right moment.
- [ ] Premiere: start is taken from `end − duration`.
- [ ] Normal (non-live) video: nothing happens and the popup says so.
- [ ] Click to another video without reloading the page: the new video's start is picked up.
- [ ] Seek far: jumps. Seek a little: doesn't. Pause: stops.
- [ ] Ad playing: no ticks.
- [ ] `chrome://extensions` → service worker → **Stop**, then sync again: still works.
- [ ] Keyboard shortcut "Sync now".
- [ ] ptb / canary Discord tabs.
- [ ] Calibrate fixes a start time that is wrong on purpose.

## Vencord plugin checklist (Phase 4)
- [ ] Pair (port + token) → **Test** says OK.
- [ ] Ticks move Discord desktop without a reload.
- [ ] Wrong token → 401.
- [ ] `curl -X POST -H "Origin: https://evil.com" http://127.0.0.1:<port>/yaydss/v1/tick` is rejected.
- [ ] Disabling the plugin stops the server.
- [ ] Follow off → no jumps.
- [ ] Looking at a different channel → switches to the synced channel.
