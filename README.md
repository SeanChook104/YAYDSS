# YAYDSS – Yet Another YouTube Discord Sync Scroll

Watch a YouTube livestream **VOD** and have a Discord channel follow along. As the video plays, Discord shows the messages people sent at the moment the video is showing. It's like reading the stream's Discord chat as it happened.

It has two parts:

| Part | What it does |
|---|---|
| **Browser extension** (Chrome, Firefox) | Reads the VOD's position on YouTube and works out the real-world time. It can jump a **Discord browser tab** there (the tab reloads each time) or send the time to the plugin. |
| **Vencord plugin** (Discord desktop) | Receives the time from the extension and scrolls the **Discord desktop app** to it: smoothly, with no reload, and with the VOD's moment at the bottom of the chat (no spoilers). |

**How it works:** every Discord message ID contains the time it was sent. So for any moment we can compute an ID and ask Discord to show the messages around it. No bot and no account token are used, and no messages are saved or exported.

> ⚠️ The Vencord plugin is a Discord client mod, which is against Discord's Terms of Service (lower risk than self-bots, but not zero). The extension on its own, using the browser-tab option, doesn't modify Discord.

---

## Install

There are no store listings yet, so you build it yourself. It takes about 10 minutes the first time.

### What you need
- [Node.js](https://nodejs.org) 22 or newer
- [Git](https://git-scm.com)
- pnpm: `npm install -g pnpm`

### 1. Get YAYDSS and build the extension
```bash
git clone https://github.com/SeanChook104/YAYDSS.git
cd YAYDSS
pnpm install
pnpm -F @yaydss/extension build            # Chrome → extension/.output/chrome-mv3
pnpm -F @yaydss/extension build:firefox    # Firefox → extension/.output/firefox-mv3
```

### 2a. Load it in Chrome (or Edge, Brave…)
1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and choose the folder `YAYDSS/extension/.output/chrome-mv3`.
3. Click the puzzle icon in the toolbar and pin **YAYDSS**.

### 2b. Or load it in Firefox (140+)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `YAYDSS/extension/.output/firefox-mv3/manifest.json`.
3. Click the puzzle icon → ⚙ next to YAYDSS → **Pin to Toolbar**.

Temporary add-ons are removed when Firefox closes, so repeat this after a restart.

### 3. (Optional) Install the Vencord plugin for Discord desktop
Skip this if you only use Discord in the browser.

Vencord only loads custom plugins from a build you made yourself. That build replaces your normal Vencord install; your Vencord settings and plugins are kept.

1. Get Vencord's source **next to** the YAYDSS folder:
   ```bash
   cd ..                     # the folder that contains YAYDSS
   git clone https://github.com/Vendicated/Vencord.git
   cd Vencord
   pnpm install --frozen-lockfile
   ```
2. Copy the plugin into Vencord and build:
   ```bash
   cd ../YAYDSS
   pnpm vencord:sync
   cd ../Vencord
   pnpm build
   ```
3. **Quit Discord completely:** right-click the Discord icon in the taskbar tray → **Quit Discord**.
4. In the Vencord folder, run `pnpm inject`. Pick your Discord (e.g. **Stable**), then **Install** (or **Repair**).
5. Open Discord → **User Settings → Vencord → Plugins**, search **YAYDSS** and switch it on.

---

## Use it

### First time: pick where Discord is
Open a YouTube VOD, click the **YAYDSS** icon, and set **Send to**:

- **Discord in a browser tab.** Nothing else to set up. Each jump reloads the Discord tab, so auto-jumps happen at most once a minute.
- **Discord desktop app (YAYDSS Vencord plugin).** Needs pairing:
  1. In Discord: **User Settings → Vencord → Plugins → YAYDSS ⚙** and copy the **Pairing token**.
  2. In the popup, paste it into **Pairing token from Discord**. Keep the port at `47810` unless you changed it in the plugin.
  3. Click **Test connection**. It should say **✓ Connected to Discord**.

### Every VOD
1. Open the stream's VOD on YouTube.
2. Click the **YAYDSS** icon.
3. **Discord channel:** in Discord, right-click the channel → **Copy Link**, then paste it here. Or open the channel in a browser tab and click **Use current Discord tab**. YAYDSS remembers the channel (and offset) for each video.
4. Press **Sync now** (or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> on the YouTube tab).
5. Play the video. With **Auto-follow** on, Discord keeps up as the video plays and when you skip around.

### Popup at a glance
| Item | Meaning |
|---|---|
| **Stream start** | The real time of the VOD's 0:00. For premieres and trimmed VODs it's worked out from the end time; a note says so. |
| **Offset** (−5 / −1 / +1 / +5 s) | Nudge the chat if it feels early or late. **+** shows later chat. |
| **Auto-follow** | Off = only **Sync now** moves Discord. |
| **Stop** | Stop syncing this YouTube tab. |
| **Discord time** | The real-world moment the video is at right now. |

### Plugin settings (Discord → Vencord → Plugins → YAYDSS ⚙)
| Setting | Meaning |
|---|---|
| **Follow** | On/off. Also on the ↻ button in the chat bar (the icons by the message box). |
| **Position** | **Bottom** (default): the newest message you see is from the VOD's moment, so no spoilers. **Middle**: Discord's normal jump, which also shows about a minute of later chat. |
| **Smooth** | Scroll smoothly instead of jumping. |
| **Flash** | Briefly highlight the message it moved to. |
| **Port / Token** | Must match the extension (the token is the pairing token). Clear the token to make a new one (then paste it into the extension again). |

Automatic updates only move Discord while you're **in the synced channel**; switch to another channel and it leaves you alone. **Sync now** always brings you back.

---

## Troubleshooting
| Problem | Fix |
|---|---|
| Popup says "Open a YouTube livestream VOD…" | Reload the YouTube tab (needed once after installing or updating the extension). |
| "This video wasn't a livestream" / "live right now" | Only VODs of past livestreams and premieres work. |
| "Can't reach Discord on port 47810" | Is Discord desktop open, with the YAYDSS plugin on? Did Discord update? Then run `pnpm inject` again. |
| "Wrong pairing token" | Copy the token again from the plugin settings and paste it into the popup. |
| Chat is a few seconds off | Use the **Offset** buttons. It's saved for that video. |
| Firefox: "site access is off" | Click **Allow access** in the popup, then reload the YouTube tab. |
| Vencord disappeared after a Discord update | Quit Discord, then run `pnpm inject` in the Vencord folder again. |

### Updating
```bash
cd YAYDSS && git pull && pnpm install && pnpm -F @yaydss/extension build
pnpm vencord:sync && cd ../Vencord && git pull && pnpm install && pnpm build
```
Then click ↻ on the extension in `chrome://extensions` (or reload it in Firefox), and restart Discord.

---

## Development
```bash
pnpm test                       # unit tests (packages/core)
pnpm typecheck
pnpm -F @yaydss/extension dev   # rebuilds on save into extension/.output/chrome-mv3-dev
pnpm vencord:watch              # copy the plugin into ../Vencord on save; run `pnpm build --watch` there
```

```
packages/core/   shared maths: snowflakes, stream start, when to jump, message format
extension/       WXT browser extension (Chrome + Firefox, Manifest V3)
vencord-plugin/  Vencord userplugin (index.tsx = Discord UI, native.ts = local server)
docs/            apis, architecture, decisions, prior art, roadmap, testing
scripts/         jump-url.mjs (manual test helper), sync-vencord.mjs
```

More detail:
- [docs/architecture.md](docs/architecture.md)
- [docs/roadmap.md](docs/roadmap.md)
- [vencord-plugin/README.md](vencord-plugin/README.md)

## Privacy
- The extension stores the channel ID and offset for each video, plus your settings, only in your browser.
- The plugin only listens on `127.0.0.1` (your own computer) and needs the pairing token. It reads the IDs of messages already loaded in your Discord, and only to find where to scroll.
- Nothing is sent anywhere else.

## License
GPL-3.0-or-later. See [LICENSE](LICENSE).
