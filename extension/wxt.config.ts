import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
    // Without this WXT builds the Firefox version as MV2.
    manifestVersion: 3,
    // `pnpm dev` would open a fresh browser profile (not logged in to Discord).
    // Instead, load .output/chrome-mv3-dev yourself; it reloads on save.
    webExt: { disabled: true },
    manifest: ({ browser }) => ({
        name: "YAYDSS – YouTube Discord Sync Scroll",
        description: "Makes a Discord channel follow a YouTube livestream VOD: shows the chat from the moment the video is at.",
        action: { default_title: "YAYDSS" },
        permissions: ["storage"],
        // *.discord.com also matches discord.com.
        // 127.0.0.1 = the YAYDSS Vencord plugin inside Discord desktop (only this computer).
        host_permissions: ["https://www.youtube.com/*", "https://*.discord.com/*", "http://127.0.0.1/*"],
        commands: {
            "sync-now": {
                suggested_key: { default: "Alt+Shift+S" },
                description: "Sync Discord to the video now"
            }
        },
        ...(browser === "firefox" && {
            browser_specific_settings: {
                gecko: {
                    id: "yaydss@seanchook104",
                    // world: "MAIN" content scripts need Firefox 128+.
                    strict_min_version: "128.0",
                    // Required for new add-ons on addons.mozilla.org since Nov 2025.
                    data_collection_permissions: { required: ["none"] }
                }
            }
        })
    })
});
