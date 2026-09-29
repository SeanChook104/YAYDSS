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
    position: {
        type: OptionType.SELECT,
        description: "Where the VOD's moment sits in the chat",
        options: [
            { label: "Bottom: the newest message you see is from the VOD's moment (no spoilers)", value: "bottom", default: true },
            { label: "Middle: Discord's normal jump (also shows some later chat)", value: "middle" }
        ]
    },
    smooth: {
        type: OptionType.BOOLEAN,
        description: "Scroll smoothly while following",
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
/** Last message we moved to. Ticks for the same moment leave your scrolling alone. */
let lastTargetId: string | null = null;
/** Retries lining up the target after Discord jumps/loads. */
let alignTimer: ReturnType<typeof setInterval> | undefined;

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
    // Like opening a message link: Discord loads the messages around that moment.
    const openLink = () => {
        lastTargetId = null;
        jumpThenAlign(tick, () => NavigationRouter.transitionTo(buildMessagePath(tick.guildId, tick.channelId, tick.messageId)));
    };

    if (SelectedChannelStore.getChannelId() !== tick.channelId) {
        // Only "Sync now" may pull you into the channel; automatic ticks leave you alone elsewhere.
        if (manual) openLink();
        return;
    }

    const target = lastLoadedMessageAtOrBefore(tick.channelId, tick.realMs);
    if (!target) return openLink();
    if (target === lastTargetId && !manual) return;
    lastTargetId = target;

    if (settings.store.position === "bottom" && alignToBottom(tick.channelId, target, settings.store.smooth)) {
        if (settings.store.flash) flash(tick.channelId, target);
        return;
    }

    // Middle position, or the message isn't on screen yet: let Discord jump to it.
    jumpThenAlign(tick, () =>
        MessageActions.jumpToMessage({
            channelId: tick.channelId,
            messageId: target,
            flash: settings.store.flash,
            jumpType: "INSTANT"
        })
    );
}

/** Let Discord jump (it centres the message), then for "bottom" line it up once it's on screen. */
function jumpThenAlign(tick: Tick, jump: () => void) {
    clearInterval(alignTimer);
    jump();
    if (settings.store.position !== "bottom") return;

    const giveUpAt = Date.now() + 5000;
    let aligned = 0;
    alignTimer = setInterval(() => {
        if (Date.now() > giveUpAt || !settings.store.follow) return clearInterval(alignTimer);
        if (SelectedChannelStore.getChannelId() !== tick.channelId) return;

        const target = lastLoadedMessageAtOrBefore(tick.channelId, tick.realMs);
        if (!target || !alignToBottom(tick.channelId, target, false)) return;
        lastTargetId = target;
        // Discord may scroll once more after loading, so line up twice.
        if (++aligned >= 2) clearInterval(alignTimer);
    }, 250);
}

/**
 * Scroll the chat so the message's bottom edge sits at the bottom of the view.
 * Returns false if the message isn't rendered.
 * Uses the message's element id (the same one Vencord's messageLogger uses),
 * not Discord's class names, which change often.
 */
function alignToBottom(channelId: string, messageId: string, smooth: boolean): boolean {
    const el = document.getElementById(`chat-messages-${channelId}-${messageId}`);
    const scroller = el && scrollParent(el);
    if (!el || !scroller) return false;

    const wantBottom = scroller.getBoundingClientRect().bottom - bottomGap(scroller);
    const delta = el.getBoundingClientRect().bottom - wantBottom;
    if (Math.abs(delta) > 1) scroller.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
    return true;
}

/** The nearest parent that scrolls vertically (the chat's scroller). */
function scrollParent(el: HTMLElement): HTMLElement | null {
    for (let n = el.parentElement; n; n = n.parentElement) {
        const { overflowY } = getComputedStyle(n);
        if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
}

/**
 * Space to leave under the message: up to the top of Discord's floating
 * "You're viewing older messages" bar, so the bar doesn't cover it.
 * Flush, so no sliver of the next (later) message peeks out.
 */
function bottomGap(scroller: HTMLElement): number {
    const bar = document.querySelector<HTMLElement>('[class*="jumpToPresentBar"]');
    if (!bar) return 0;
    const s = scroller.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return b.height > 0 && b.top < s.bottom && b.bottom > s.top ? s.bottom - b.top : 0;
}

function flash(channelId: string, messageId: string) {
    const el = document.getElementById(`chat-messages-${channelId}-${messageId}`);
    if (!el) return;
    el.classList.remove("vc-yaydss-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("vc-yaydss-flash");
    setTimeout(() => el.classList.remove("vc-yaydss-flash"), 1600);
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
                lastTargetId = null; // re-line-up on the next tick
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
            lastTargetId = null;
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
        clearInterval(alignTimer);
        lastTargetId = null;
        if (!IS_WEB) void Native?.stopServer();
    }
});
