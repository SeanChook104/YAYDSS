/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 SeanChook104
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, type ChatBarButtonFactory } from "@api/ChatButtons";
import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { type IconComponent, OptionType, type PluginNative } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import {
    ChannelStore,
    ContextMenuApi,
    Menu,
    MessageActions,
    MessageStore,
    NavigationRouter,
    SelectedChannelStore,
    showToast,
    useEffect,
    useState
} from "@webpack/common";

import { buildMessagePath, msFromSnowflake, snowflakeFromMs, type Tick } from "./core";
import managedStyle from "./style.css?managed";

const Native = VencordNative.pluginHelpers.YAYDSS as PluginNative<typeof import("./native")>;
const logger = new Logger("YAYDSS");

const LONG_POLL_MS = 25_000;
/** How often the plugin's own clock moves the chat while playing. */
const CLOCK_STEP_MS = 1000;

const settings = definePluginSettings({
    follow: {
        type: OptionType.BOOLEAN,
        description: "Follow: move the chat (from the extension, or the plugin's own clock)",
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

/** A moment to show in a channel. */
interface Moment {
    guildId: string;
    channelId: string;
    realMs: number;
    /** From "Sync now" or a click: may switch channel, and re-lines up even if nothing changed. */
    manual: boolean;
}

/**
 * The plugin's own clock: the chat time keeps moving while `running`, between
 * extension ticks or with no extension at all (e.g. a video playing in VLC).
 */
interface Clock {
    guildId: string;
    channelId: string;
    /** Chat time at `anchorAt` (local Date.now()). */
    anchorMs: number;
    anchorAt: number;
    running: boolean;
}

let clock: Clock | null = null;

function clockNow(c: Clock): number {
    return c.anchorMs + (c.running ? Date.now() - c.anchorAt : 0);
}

/** Bumped on every (re)start/stop so old long-poll loops end. */
let generation = 0;
/** Last message we moved to. Updates for the same moment leave your scrolling alone. */
let lastTargetId: string | null = null;
/** Retries lining up the target after Discord jumps/loads. */
let alignTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

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
        showToast({ text: `YAYDSS: ${res.error}`, variant: "critical" });
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

/** The extension says where the video is: set the clock to it and show that moment. */
function handleTick(tick: Tick) {
    if (!settings.store.follow) return;
    const { guildId, channelId, realMs } = tick;
    clock = { guildId, channelId, anchorMs: realMs, anchorAt: Date.now(), running: tick.playing ?? true };
    showMoment({ guildId, channelId, realMs, manual: tick.reason === "manual" });
}

/** Every second while the clock runs: move the chat along by itself. */
function clockStep() {
    if (!clock?.running || !settings.store.follow) return;
    const { guildId, channelId } = clock;
    showMoment({ guildId, channelId, realMs: clockNow(clock), manual: false });
}

function showMoment(m: Moment) {
    // Like opening a message link: Discord loads the messages around that moment.
    const openLink = () => {
        lastTargetId = null;
        jumpThenAlign(m, () => NavigationRouter.transitionTo(buildMessagePath(m.guildId, m.channelId, snowflakeFromMs(m.realMs))));
    };

    if (SelectedChannelStore.getChannelId() !== m.channelId) {
        // Only a manual sync may pull you into the channel; automatic updates leave you alone elsewhere.
        if (m.manual) openLink();
        return;
    }

    const target = lastLoadedMessageAtOrBefore(m.channelId, m.realMs);
    if (!target) return openLink();
    if (target === lastTargetId && !m.manual) return;
    lastTargetId = target;

    if (settings.store.position === "bottom" && alignToBottom(m.channelId, target, settings.store.smooth)) {
        if (settings.store.flash) flash(m.channelId, target);
        return;
    }

    // Middle position, or the message isn't on screen yet: let Discord jump to it.
    jumpThenAlign(m, () =>
        MessageActions.jumpToMessage({
            channelId: m.channelId,
            messageId: target,
            flash: settings.store.flash,
            jumpType: "INSTANT"
        })
    );
}

/** Let Discord jump (it centres the message), then for "bottom" line it up once it's on screen. */
function jumpThenAlign(m: Moment, jump: () => void) {
    clearInterval(alignTimer);
    jump();
    if (settings.store.position !== "bottom") return;

    const giveUpAt = Date.now() + 5000;
    let aligned = 0;
    alignTimer = setInterval(() => {
        if (Date.now() > giveUpAt || !settings.store.follow) return clearInterval(alignTimer);
        if (SelectedChannelStore.getChannelId() !== m.channelId) return;

        // While the clock runs, line up with where it is now, not where it was.
        const realMs = clock?.running && clock.channelId === m.channelId ? clockNow(clock) : m.realMs;
        const target = lastLoadedMessageAtOrBefore(m.channelId, realMs);
        if (!target || !alignToBottom(m.channelId, target, false)) return;
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

// ── Clock controls ────────────────────────────────────────────────────────────

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString();

/** Start the clock from a message: its send time becomes "now" in the chat. */
function startFrom(message: Message, play: boolean) {
    const channelId = message.channel_id;
    const guildId = ChannelStore.getChannel(channelId)?.guild_id || "@me";
    const anchorMs = msFromSnowflake(message.id);
    clock = { guildId, channelId, anchorMs, anchorAt: Date.now(), running: play };
    settings.store.follow = true;
    showMoment({ guildId, channelId, realMs: anchorMs, manual: true });
    showToast({
        text: play
            ? `YAYDSS: playing from ${fmtTime(anchorMs)}`
            : `YAYDSS: clock set to ${fmtTime(anchorMs)}. Press ▶ in the chat bar when your video reaches this moment.`,
        variant: "success"
    });
}

function setRunning(running: boolean) {
    if (!clock || clock.running === running) return;
    clock = { ...clock, anchorMs: clockNow(clock), anchorAt: Date.now(), running };
    if (running) settings.store.follow = true;
    clockStep();
}

function nudge(deltaMs: number) {
    if (!clock) return;
    clock = { ...clock, anchorMs: clockNow(clock) + deltaMs, anchorAt: Date.now() };
    const { guildId, channelId } = clock;
    showMoment({ guildId, channelId, realMs: clockNow(clock), manual: true });
}

function stopClock() {
    clock = null;
    lastTargetId = null;
    clearInterval(alignTimer);
}

const messageMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message?: Message; }) => {
    if (!message?.id) return;
    children.push(
        <Menu.MenuGroup>
            <Menu.MenuItem id="vc-yaydss-start-here" label="YAYDSS: start clock here (paused)" action={() => startFrom(message, false)} />
            <Menu.MenuItem id="vc-yaydss-play-here" label="YAYDSS: play from here" action={() => startFrom(message, true)} />
        </Menu.MenuGroup>
    );
};

function ClockMenu() {
    const { follow } = settings.use(["follow"]);
    return (
        <Menu.Menu navId="vc-yaydss-clock" onClose={ContextMenuApi.closeContextMenu} aria-label="YAYDSS clock">
            <Menu.MenuItem id="vc-yaydss-back30" label="Back 30 s" disabled={!clock} action={() => nudge(-30_000)} />
            <Menu.MenuItem id="vc-yaydss-back5" label="Back 5 s" disabled={!clock} action={() => nudge(-5_000)} />
            <Menu.MenuItem id="vc-yaydss-fwd5" label="Forward 5 s" disabled={!clock} action={() => nudge(5_000)} />
            <Menu.MenuItem id="vc-yaydss-fwd30" label="Forward 30 s" disabled={!clock} action={() => nudge(30_000)} />
            <Menu.MenuSeparator />
            <Menu.MenuCheckboxItem
                id="vc-yaydss-follow"
                label="Follow (move the chat)"
                checked={follow}
                action={() => {
                    settings.store.follow = !follow;
                    lastTargetId = null;
                }}
            />
            <Menu.MenuItem id="vc-yaydss-stop" label="Stop clock" color="danger" disabled={!clock} action={stopClock} />
        </Menu.Menu>
    );
}

const SyncIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
            fill="currentColor"
            d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8Zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3Z"
        />
    </svg>
);

const PlayIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.98-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
);

const PauseIcon: IconComponent = ({ height = 20, width = 20, className }) => (
    <svg width={width} height={height} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
);

/** Chat-bar button: click = play/pause the clock, right-click = nudges, follow, stop. */
const ClockButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { follow } = settings.use(["follow"]);
    const [, rerender] = useState(0);
    useEffect(() => {
        const id = setInterval(() => rerender(n => n + 1), 1000); // keep the tooltip time fresh
        return () => clearInterval(id);
    }, []);
    if (!isMainChat) return null;

    const c = clock;
    const time = c ? fmtTime(clockNow(c)) : null;
    const tooltip = !follow
        ? "YAYDSS: not following (click to follow)"
        : !c
          ? "YAYDSS: no clock yet. Sync in the extension, or right-click a message → YAYDSS"
          : c.running
            ? `YAYDSS: ${time} (playing). Click to pause, right-click for more`
            : `YAYDSS: ${time} (paused). Click to play, right-click for more`;

    return (
        <ChatBarButton
            tooltip={tooltip}
            onClick={() => {
                if (!follow) {
                    settings.store.follow = true;
                    lastTargetId = null;
                } else if (!clock) {
                    showToast({ text: "YAYDSS: press Sync in the extension, or right-click a message → YAYDSS: start clock here" });
                } else {
                    setRunning(!clock.running);
                }
                rerender(n => n + 1);
            }}
            onContextMenu={e => ContextMenuApi.openContextMenu(e, () => <ClockMenu />)}
        >
            {!follow || !c ? (
                <SyncIcon className={follow ? undefined : "vc-yaydss-off"} />
            ) : c.running ? (
                <PauseIcon />
            ) : (
                <PlayIcon />
            )}
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "YAYDSS",
    description:
        "Yet Another YouTube Discord Sync Scroll: scrolls the chat along with a YouTube livestream VOD (via the YAYDSS browser extension) or its own clock.",
    authors: [{ name: "SeanChook104", id: 0n }],
    tags: ["Chat", "Media"],
    settings,

    chatBarButton: {
        icon: SyncIcon,
        render: ClockButton
    },

    contextMenus: {
        message: messageMenuPatch
    },

    toolboxActions: {
        "Copy YAYDSS pairing token": () => void copyWithToast(settings.store.token, "Pairing token copied"),
        "YAYDSS: play / pause clock": () => {
            if (clock) setRunning(!clock.running);
            else showToast({ text: "YAYDSS: no clock yet" });
        },
        "Toggle YAYDSS follow": () => {
            settings.store.follow = !settings.store.follow;
            lastTargetId = null;
            showToast({ text: `YAYDSS: ${settings.store.follow ? "following" : "not following"}` });
        }
    },

    managedStyle,

    start() {
        clockTimer = setInterval(clockStep, CLOCK_STEP_MS);
        if (IS_WEB) {
            logger.warn("The extension bridge only works in Discord desktop / Vesktop. The clock still works.");
            return;
        }
        void restartServer();
    },

    stop() {
        generation++;
        clearInterval(clockTimer);
        stopClock();
        if (!IS_WEB) void Native?.stopServer();
    }
});
