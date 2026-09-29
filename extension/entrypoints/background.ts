import {
    buildMessageUrl,
    chooseStart,
    decideJump,
    DISCORD_HOSTS,
    INITIAL_JUMP_STATE,
    parseDiscordUrl,
    PROTOCOL_VERSION,
    realMs,
    recordJump,
    snowflakeFromMs,
    type DiscordChannel,
    type JumpReason,
    type StartChoice,
    type Tick
} from "@yaydss/core";
import type { Browser } from "wxt/browser";
import { getSettings, getVideoMemory, linksItem } from "@/utils/storage";
import type {
    BackgroundMessage,
    ContentMessage,
    JumpResult,
    Settings,
    Status,
    TabLink,
    TestResult,
    VideoMemory,
    VideoReport
} from "@/utils/types";

export default defineBackground(() => {
    // Register listeners straight away: Chrome stops the service worker when idle
    // and only listeners added at start-up wake it up again.
    browser.runtime.onMessage.addListener((msg: BackgroundMessage, sender, sendResponse) => {
        handleMessage(msg, sender).then(sendResponse, err => {
            console.error("[YAYDSS]", err);
            sendResponse(undefined);
        });
        return true; // answer comes later (async)
    });

    browser.commands.onCommand.addListener(async command => {
        if (command !== "sync-now") return;
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id != null) await syncNow(tab.id);
    });

    browser.tabs.onRemoved.addListener(tabId => void serial(() => forgetTab(tabId)));
});

async function handleMessage(msg: BackgroundMessage, sender: Browser.runtime.MessageSender): Promise<unknown> {
    switch (msg.type) {
        case "yt-report": {
            const tabId = sender.tab?.id;
            if (tabId == null || msg.reason === "pause") return;
            const reason: JumpReason = msg.reason === "heartbeat" ? "interval" : msg.reason;
            return serial(() => onReport(tabId, reason, msg.report));
        }
        case "get-status":
            return getStatus(msg.tabId);
        case "sync-now":
            return syncNow(msg.tabId);
        case "stop":
            return serial(() => setLink(msg.tabId, link => link && { ...link, enabled: false }));
        case "test-vencord":
            return testVencord();
    }
}

/** Run state changes one at a time, so two reports can't both decide to jump. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn);
    queue = run.catch(() => undefined);
    return run;
}

async function onReport(tabId: number, reason: JumpReason, report: VideoReport): Promise<void> {
    const link = (await linksItem.getValue())[tabId];
    if (link?.enabled) await jumpIfNeeded(tabId, link, reason, report);
}

/** "Sync now" button / keyboard shortcut. Also turns syncing on for the tab. */
async function syncNow(tabId: number): Promise<JumpResult> {
    const report = await askReport(tabId);
    if (!report) return { ok: false, error: NO_VIDEO };
    return serial(async () => {
        const link = (await linksItem.getValue())[tabId] ?? newLink();
        return jumpIfNeeded(tabId, { ...link, enabled: true }, "manual", report);
    });
}

async function jumpIfNeeded(tabId: number, link: TabLink, reason: JumpReason, report: VideoReport): Promise<JumpResult> {
    const memory = await getVideoMemory(report.videoId);
    const { targetMs, problem } = computeTarget(report, memory);
    if (problem || targetMs == null || !memory) return { ok: false, error: problem ?? "Can't work out the time." };

    const settings = await getSettings();
    const mode = settings.target === "vencord" ? "vencord" : "url";
    const now = Date.now();
    const event = { reason, targetMs, videoPaused: report.paused };
    if (!decideJump(link.jump, event, now, { mode, auto: settings.auto })) return { ok: true, jumped: false, targetMs };

    let { discordTabId } = link;
    if (mode === "vencord") {
        const error = await sendToVencord(settings, makeTick(report, memory.channel, targetMs, reason));
        if (error) return { ok: false, error };
    } else {
        discordTabId = await openInDiscord(discordTabId, memory.channel, targetMs);
    }
    await setLink(tabId, () => ({ enabled: true, discordTabId, jump: recordJump(targetMs, now) }));
    return { ok: true, jumped: true, targetMs };
}

/** Increases even across service-worker restarts (Date.now based). */
let lastSeq = 0;

function makeTick(report: VideoReport, channel: DiscordChannel, targetMs: number, reason: JumpReason): Tick {
    lastSeq = Math.max(lastSeq + 1, Date.now());
    return {
        v: PROTOCOL_VERSION,
        seq: lastSeq,
        sentAt: Date.now(),
        videoId: report.videoId,
        guildId: channel.guildId,
        channelId: channel.channelId,
        messageId: snowflakeFromMs(targetMs),
        realMs: targetMs,
        reason
    };
}

/** Talk to the YAYDSS Vencord plugin in Discord desktop. Returns an error message, or null if OK. */
async function callVencord(settings: Settings, path: "ping" | "tick", body?: Tick): Promise<string | null> {
    if (!settings.vencordToken) return "Paste the pairing token from Discord first (Settings → Plugins → YAYDSS).";
    try {
        const res = await fetch(`http://127.0.0.1:${settings.vencordPort}/yaydss/v1/${path}`, {
            method: body ? "POST" : "GET",
            headers: {
                Authorization: `Bearer ${settings.vencordToken}`,
                ...(body && { "Content-Type": "application/json" })
            },
            body: body && JSON.stringify(body),
            signal: AbortSignal.timeout(3000)
        });
        if (res.ok) return null;
        if (res.status === 401) return "Wrong pairing token. Copy it again from Discord (Settings → Plugins → YAYDSS).";
        const info = await res.json().catch(() => null);
        return `The plugin answered ${res.status}${info?.error ? `: ${info.error}` : ""}.`;
    } catch {
        return `Can't reach Discord on port ${settings.vencordPort}. Is Discord desktop open with the YAYDSS plugin on?`;
    }
}

const sendToVencord = (settings: Settings, tick: Tick) => callVencord(settings, "tick", tick);

async function testVencord(): Promise<TestResult> {
    const error = await callVencord(await getSettings(), "ping");
    return error ? { ok: false, error } : { ok: true };
}

const NO_VIDEO = "Open a YouTube livestream VOD in this tab. (Just installed YAYDSS? Reload the YouTube tab.)";

/** The real-world moment the VOD shows, or why we can't tell. */
function computeTarget(
    report: VideoReport,
    memory: VideoMemory | null
): { choice: StartChoice; targetMs: number | null; problem: string | null } {
    const choice = chooseStart(report.facts?.broadcast, report.facts?.lengthSeconds ?? report.duration);
    const targetMs =
        choice.startMs != null && !report.ad ? realMs(choice.startMs, report.currentTime, memory?.offsetMs ?? 0) : null;

    let problem: string | null = null;
    if (!report.facts) problem = "Reading the video info… Reload the YouTube tab if this doesn't go away.";
    else if (choice.kind === "live-now") problem = "This stream is live right now. YAYDSS only works with VODs.";
    else if (choice.startMs == null) problem = "This video wasn't a livestream or premiere, so there's no chat time to sync.";
    else if (report.ad) problem = "Waiting for the ad to finish.";
    else if (!memory) problem = "Pick a Discord channel for this video first.";

    return { choice, targetMs, problem };
}

/** Point a Discord tab at the moment (reuses the synced tab, else a tab on that channel, else opens one). */
async function openInDiscord(knownTabId: number | null, channel: DiscordChannel, targetMs: number): Promise<number | null> {
    const url = buildMessageUrl(channel, snowflakeFromMs(targetMs));
    const tab = (await getDiscordTab(knownTabId)) ?? (await findChannelTab(channel));
    if (tab?.id != null) {
        if (tab.url !== url) await browser.tabs.update(tab.id, { url });
        return tab.id;
    }
    const created = await browser.tabs.create({ url, active: false });
    return created.id ?? null;
}

async function getDiscordTab(tabId: number | null): Promise<Browser.tabs.Tab | null> {
    if (tabId == null) return null;
    try {
        const tab = await browser.tabs.get(tabId);
        return tab.url && parseDiscordUrl(tab.url) ? tab : null;
    } catch {
        return null; // tab was closed
    }
}

async function findChannelTab(channel: DiscordChannel): Promise<Browser.tabs.Tab | null> {
    const url = DISCORD_HOSTS.map(host => `https://${host}/channels/${channel.guildId}/${channel.channelId}*`);
    const tabs = await browser.tabs.query({ url });
    return tabs[0] ?? null;
}

async function getStatus(tabId: number): Promise<Status> {
    const [report, settings, links] = await Promise.all([askReport(tabId), getSettings(), linksItem.getValue()]);
    const link = links[tabId] ?? null;
    if (!report) return { report, memory: null, choice: null, targetMs: null, link, settings, problem: NO_VIDEO };

    const memory = await getVideoMemory(report.videoId);
    return { report, memory, link, settings, ...computeTarget(report, memory) };
}

async function askReport(tabId: number): Promise<VideoReport | null> {
    try {
        return (await browser.tabs.sendMessage(tabId, { type: "get-report" } satisfies ContentMessage)) ?? null;
    } catch {
        return null; // not a YouTube tab, or the content script isn't there yet
    }
}

function newLink(): TabLink {
    return { enabled: true, discordTabId: null, jump: INITIAL_JUMP_STATE };
}

async function setLink(tabId: number, update: (link: TabLink | undefined) => TabLink | undefined): Promise<void> {
    const links = await linksItem.getValue();
    const next = update(links[tabId]);
    if (next) links[tabId] = next;
    else delete links[tabId];
    await linksItem.setValue(links);
}

async function forgetTab(tabId: number): Promise<void> {
    const links = await linksItem.getValue();
    delete links[tabId];
    for (const link of Object.values(links)) {
        if (link.discordTabId === tabId) link.discordTabId = null;
    }
    await linksItem.setValue(links);
}
