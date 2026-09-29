/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 SeanChook104
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, type ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { type IconComponent, OptionType, type PluginNative } from "@utils/types";
import { MessageActions, MessageStore, NavigationRouter, SelectedChannelStore, showToast, Toasts } from "@webpack/common";

import { buildMessagePath, msFromSnowflake, type Tick } from "./core";
import managedStyle from "./style.css?managed";

const Native = VencordNative.pluginHelpers.YAYDSS as PluginNative<typeof import("./native")>;
const logger = new Logger("YAYDSS");

const LONG_POLL_MS = 25_000;

const settings = definePluginSettings({
    follow: {
        type: OptionType.BOOLEAN,
        description: "Follow the VOD: jump when the YAYDSS extension sends a time",
        default: true
    },
    flash: {
        type: OptionType.BOOLEAN,
        description: "Highlight the message it jumps to",
        default: false
    },
    port: {
        type: OptionType.NUMBER,
        description: "Port the extension talks to (only reachable from this computer, 127.0.0.1)",
        default: 47810,
        onChange: () => void restartServer()
    },
    token: {
        type: OptionType.STRING,
        description: "Pairing token: paste this into the YAYDSS extension popup. Clear it to make a new one.",
        default: "",
        onChange: () => void restartServer()
    }
});

/** Bumped on every (re)start/stop so old long-poll loops end. */
let generation = 0;
/** Last real message we jumped to, so we don't re-jump to the same one every tick. */
let lastJumpedId: string | null = null;

function newToken() {
    return crypto.randomUUID().replaceAll("-", "");
}

async function restartServer() {
    const gen = ++generation;
    if (IS_WEB || !Native) return;

    if (!settings.store.token) settings.store.token = newToken(); // triggers onChange → restartServer again
    if (gen !== generation) return;

    const res = await Native.startServer(settings.store.port, settings.store.token);
    if (gen !== generation) return;
    if (!res.ok) {
        logger.error("Server didn't start:", res.error);
        showToast(`YAYDSS: ${res.error}`, Toasts.Type.FAILURE);
        return;
    }
    logger.info(`Listening on 127.0.0.1:${settings.store.port}`);
    void pollLoop(gen);
}

async function pollLoop(gen: number) {
    let after = 0;
    while (gen === generation) {
        try {
            const got = await Native.waitForTick(after, LONG_POLL_MS);
            if (gen !== generation) return;
            if (got) {
                after = got.n;
                handleTick(got.tick);
            }
        } catch (e) {
            logger.error("Polling failed", e);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

function handleTick(tick: Tick) {
    if (!settings.store.follow) return;

    const manual = tick.reason === "manual";
    const path = buildMessagePath(tick.guildId, tick.channelId, tick.messageId);

    if (SelectedChannelStore.getChannelId() !== tick.channelId) {
        // Only "Sync now" may pull you into the channel; automatic ticks leave you alone elsewhere.
        if (manual) {
            lastJumpedId = null;
            NavigationRouter.transitionTo(path);
        }
        return;
    }

    const loaded = lastLoadedMessageAtOrBefore(tick.channelId, tick.realMs);
    if (loaded) {
        if (loaded === lastJumpedId && !manual) return;
        lastJumpedId = loaded;
        MessageActions.jumpToMessage({
            channelId: tick.channelId,
            messageId: loaded,
            flash: settings.store.flash,
            jumpType: "INSTANT"
        });
    } else {
        // Not loaded yet: same as opening a message link, Discord fetches messages around that moment.
        lastJumpedId = null;
        NavigationRouter.transitionTo(path);
    }
}

/**
 * The newest already-loaded message sent at or before `targetMs`, or null if the
 * target is outside what Discord has loaded. Only reads IDs (which encode the time),
 * never stores anything.
 */
function lastLoadedMessageAtOrBefore(channelId: string, targetMs: number): string | null {
    const channel = MessageStore.getMessages(channelId);
    const messages = channel?._array;
    if (!messages?.length) return null;

    let oldest = Infinity;
    let newest = -Infinity;
    let best: { id: string; ms: number } | null = null;
    for (const { id } of messages) {
        const ms = msFromSnowflake(id);
        oldest = Math.min(oldest, ms);
        newest = Math.max(newest, ms);
        if (ms <= targetMs && (!best || ms > best.ms)) best = { id, ms };
    }

    if (targetMs < oldest && channel.hasMoreBefore) return null;
    if (targetMs > newest && channel.hasMoreAfter) return null;
    return best?.id ?? null;
}

const SyncIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
            fill="currentColor"
            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8Zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3Z"
        />
    </svg>
);

const FollowButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { follow } = settings.use(["follow"]);
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={follow ? "YAYDSS: following the VOD (click to stop)" : "YAYDSS: not following (click to follow)"}
            onClick={() => {
                settings.store.follow = !follow;
                lastJumpedId = null;
            }}
        >
            <SyncIcon className={follow ? undefined : "vc-yaydss-off"} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "YAYDSS",
    description:
        "Yet Another YouTube Discord Sync Scroll: jumps the chat to the moment a YouTube livestream VOD is showing. Needs the YAYDSS browser extension.",
    authors: [{ name: "SeanChook104", id: 0n }],
    tags: ["Chat", "Media"],
    settings,

    chatBarButton: {
        icon: SyncIcon,
        render: FollowButton
    },

    toolboxActions: {
        "Copy YAYDSS pairing token": () => void copyWithToast(settings.store.token, "Pairing token copied"),
        "Toggle YAYDSS follow": () => {
            settings.store.follow = !settings.store.follow;
            showToast(`YAYDSS: ${settings.store.follow ? "following" : "not following"}`);
        }
    },

    managedStyle,

    start() {
        if (IS_WEB) {
            logger.warn("The localhost bridge only works in Discord desktop / Vesktop.");
            return;
        }
        void restartServer();
    },

    stop() {
        generation++;
        lastJumpedId = null;
        if (!IS_WEB) void Native?.stopServer();
    }
});
