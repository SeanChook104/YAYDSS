# YAYDSS – Yet Another YouTube Discord Sync Scroll

Watch a YouTube livestream **VOD** and have a public Discord channel follow along. Discord shows the messages people sent at the moment the video is showing.

- **Browser extension** (Chrome + Firefox): jumps your Discord tab to the right moment. _(in progress)_
- **Vencord plugin** (Discord desktop): smooth in-app jumps, fed by the extension. _(planned)_

## How it works
Discord message IDs encode their creation time. So for any moment we can compute an ID and open `discord.com/channels/<server>/<channel>/<id>`. Discord then loads the messages around that moment. No bot, no token, and nothing is exported. See `docs/architecture.md`.

## Layout
```
packages/core/   shared sync maths + tests
extension/       WXT browser extension (coming)
vencord-plugin/  Vencord userplugin (coming)
docs/            apis, architecture, decisions, prior art, roadmap, testing
scripts/         helpers (jump-url.mjs)
```

## Develop
```
npm i -g pnpm
pnpm install
pnpm test
```

## License
GPL-3.0-or-later. See `LICENSE`.
