import "./style.css";
import { DISCORD_HOSTS, formatClock, parseClock, parseDiscordUrl, type DiscordChannel, type StartWarning } from "@yaydss/core";
import { setSettings, updateVideoMemory } from "@/utils/storage";
import type { BackgroundMessage, JumpResult, LineUpResult, Settings, Status, TestResult, VideoMemory } from "@/utils/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
    state: $("state"),
    access: $("access"),
    grant: $<HTMLButtonElement>("grant"),
    title: $("title"),
    author: $("author"),
    start: $("start"),
    notes: $("notes"),
    problem: $("problem"),
    settings: $<HTMLFieldSetElement>("settings"),
    lineup: $("lineup"),
    luUrl: $<HTMLInputElement>("lu-url"),
    luYt: $<HTMLInputElement>("lu-yt"),
    luVideo: $<HTMLInputElement>("lu-video"),
    luNow: $<HTMLButtonElement>("lu-now"),
    luGo: $<HTMLButtonElement>("lu-go"),
    luResult: $("lu-result"),
    channel: $<HTMLInputElement>("channel"),
    useTab: $<HTMLButtonElement>("use-tab"),
    channelLabel: $("channel-label"),
    offsetRow: $("offset-row"),
    offset: $<HTMLInputElement>("offset"),
    auto: $<HTMLInputElement>("auto"),
    autoLabel: $("auto-label"),
    sendTo: $<HTMLSelectElement>("send-to"),
    vencordBox: $("vencord-box"),
    vPort: $<HTMLInputElement>("v-port"),
    vToken: $<HTMLInputElement>("v-token"),
    vTest: $<HTMLButtonElement>("v-test"),
    vResult: $("v-result"),
    sync: $<HTMLButtonElement>("sync"),
    stop: $<HTMLButtonElement>("stop"),
    message: $("message"),
    target: $("target")
};

const WARNINGS: Record<StartWarning, string> = {
    "vod-shorter-than-broadcast":
        "The VOD is shorter than the stream (trimmed start, or a 12 h+ stream). Start is worked out from the end; fine-tune with the offset.",
    processing: "YouTube is still processing this VOD, so times may shift a little.",
    "fallback-anchor": "Only part of the stream's time info was available. Check it and adjust the offset."
};

let tabId: number | null = null;
let status: Status | null = null;
/** Chrome only lets extensions into file:// tabs after a switch in its settings. */
let fileAccess = true;

const send = <T>(msg: BackgroundMessage) => browser.runtime.sendMessage(msg) as Promise<T>;
const fmtTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
const channelLink = (c: DiscordChannel) => `https://${c.host}/channels/${c.guildId}/${c.channelId}`;

function say(text: string, kind: "ok" | "error" = "ok") {
    el.message.textContent = text;
    el.message.dataset.kind = kind;
}

async function refresh() {
    if (tabId == null) return;
    status = await send<Status>({ type: "get-status", tabId });
    if (status) render(status);
}

function render(s: Status) {
    const facts = s.report?.facts;
    const syncing = s.link?.enabled === true;

    el.state.textContent = syncing ? (s.problem ? "Waiting" : "Syncing") : "Off";
    el.state.dataset.kind = syncing ? (s.problem ? "wait" : "on") : "off";

    el.title.textContent = facts?.title || (s.report ? "YouTube video" : "No video");
    el.author.textContent = facts?.author ?? "";
    el.start.textContent =
        s.startMs == null
            ? ""
            : s.startSource === "lined-up"
              ? `Video start: ${fmtTime(s.startMs)} (lined up with YouTube)`
              : `Stream start: ${fmtTime(s.startMs)}` + (s.choice?.anchor === "end-minus-duration" ? " (from end − length)" : "");

    const notes = [
        ...(s.choice?.kind === "premiere" ? ["Premiere: start is worked out from the end, to skip the countdown."] : []),
        ...(s.choice?.warnings ?? []).map(w => WARNINGS[w])
    ];
    el.notes.replaceChildren(
        ...notes.map(text => {
            const li = document.createElement("li");
            li.textContent = text;
            return li;
        })
    );

    const problem =
        !s.report && !fileAccess
            ? `${s.problem} For a video file: open chrome://extensions → YAYDSS → Details → switch on "Allow access to file URLs".`
            : s.problem;
    el.problem.hidden = !problem;
    el.problem.textContent = problem ?? "";

    el.settings.disabled = !s.report;
    renderLineUp(s);
    // Don't overwrite what the user is typing.
    if (document.activeElement !== el.channel) el.channel.value = s.memory?.channel ? channelLink(s.memory.channel) : "";
    el.channelLabel.textContent = s.memory?.channelLabel ?? "";
    if (document.activeElement !== el.offset) el.offset.value = String((s.memory?.offsetMs ?? 0) / 1000);
    el.auto.checked = s.settings.auto;
    const vencord = s.settings.target === "vencord";
    el.autoLabel.textContent = vencord
        ? "Auto-follow: keeps Discord in step as the video plays"
        : "Auto-follow: on play/seek and every 60 s";

    el.sendTo.value = s.settings.target;
    el.vencordBox.hidden = !vencord;
    if (document.activeElement !== el.vPort) el.vPort.value = String(s.settings.vencordPort);
    if (document.activeElement !== el.vToken) el.vToken.value = s.settings.vencordToken;

    el.sync.disabled = !s.report;
    el.stop.disabled = !syncing;
    el.target.textContent = s.targetMs != null ? fmtTime(s.targetMs) : "–";
}

/** "Line up with YouTube" box: only for local video files (or videos already lined up). */
function renderLineUp(s: Status) {
    el.lineup.hidden = !(s.report?.facts?.source === "file" || s.startSource === "lined-up");
    const saved = s.memory?.lineUp;
    if (!saved) return;
    // Show what was used last time, unless the user is editing.
    const typing = [el.luUrl, el.luYt, el.luVideo].includes(document.activeElement as HTMLInputElement);
    if (typing || el.luUrl.value || el.luYt.value || el.luVideo.value) return;
    el.luUrl.value = saved.youtubeUrl;
    el.luYt.value = formatClock(saved.youtubeSeconds);
    el.luVideo.value = formatClock(saved.videoSeconds);
}

/** Save channel / offset for the current video. */
async function saveMemory(patch: Partial<Pick<VideoMemory, "channel" | "channelLabel" | "offsetMs">>) {
    const videoId = status?.report?.videoId;
    if (!videoId) return;
    await updateVideoMemory(videoId, patch);
    await refresh();
}

el.luNow.addEventListener("click", () => {
    if (status?.report) el.luVideo.value = formatClock(status.report.currentTime);
});

el.luGo.addEventListener("click", async () => {
    const videoId = status?.report?.videoId;
    const youtubeSeconds = parseClock(el.luYt.value);
    const videoSeconds = parseClock(el.luVideo.value);
    const show = (text: string, kind: "ok" | "error") => {
        el.luResult.textContent = text;
        el.luResult.title = text;
        el.luResult.dataset.kind = kind;
    };
    if (!videoId) return;
    if (youtubeSeconds == null || videoSeconds == null) return show("Type both times, like 12:40 or 1:02:03.", "error");

    show("Checking YouTube…", "ok");
    const result = await send<LineUpResult>({
        type: "line-up",
        videoId,
        youtubeUrl: el.luUrl.value.trim(),
        youtubeSeconds,
        videoSeconds
    });
    if (!result?.ok) return show(result?.error ?? "Failed", "error");
    show(`✓ Lined up. This video started ${fmtTime(result.startMs)}`, "ok");
    await refresh();
});

el.channel.addEventListener("change", async () => {
    const value = el.channel.value.trim();
    if (!value) return;
    const loc = parseDiscordUrl(value);
    if (!loc) return say("That isn't a Discord channel link. Right-click the channel → Copy Link.", "error");
    const { host, guildId, channelId } = loc;
    await saveMemory({ channel: { host, guildId, channelId } });
    say("Channel saved for this video.");
});

el.useTab.addEventListener("click", async () => {
    const tabs = await browser.tabs.query({ url: DISCORD_HOSTS.map(h => `https://${h}/channels/*`) });
    tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
    for (const tab of tabs) {
        const loc = tab.url ? parseDiscordUrl(tab.url) : null;
        if (!loc) continue;
        const { host, guildId, channelId } = loc;
        const label = tab.title?.replace(/^Discord \| /, "").replace(/ [-|] Discord$/, "");
        await saveMemory({ channel: { host, guildId, channelId }, channelLabel: label });
        return say("Channel saved for this video.");
    }
    say("No Discord channel tab found. Open the channel in a tab first.", "error");
});

el.offsetRow.addEventListener("click", e => {
    const delta = Number((e.target as HTMLElement).dataset?.delta);
    if (delta) void saveMemory({ offsetMs: (status?.memory?.offsetMs ?? 0) + delta });
});

el.offset.addEventListener("change", () => {
    const seconds = Number(el.offset.value);
    if (Number.isFinite(seconds)) void saveMemory({ offsetMs: Math.round(seconds * 1000) });
});

async function saveSettings(patch: Partial<Settings>) {
    await setSettings(patch);
    await refresh();
}

el.auto.addEventListener("change", () => void saveSettings({ auto: el.auto.checked }));
el.sendTo.addEventListener("change", () => void saveSettings({ target: el.sendTo.value as Settings["target"] }));
el.vToken.addEventListener("change", () => void saveSettings({ vencordToken: el.vToken.value.trim() }));
el.vPort.addEventListener("change", () => {
    const port = Number(el.vPort.value);
    if (Number.isInteger(port) && port >= 1024 && port <= 65535) void saveSettings({ vencordPort: port });
});

el.vTest.addEventListener("click", async () => {
    // Save whatever is typed before testing.
    await setSettings({ vencordToken: el.vToken.value.trim(), vencordPort: Number(el.vPort.value) || 47810 });
    el.vResult.textContent = "Testing…";
    const result = await send<TestResult>({ type: "test-vencord" });
    el.vResult.textContent = result?.ok ? "✓ Connected to Discord" : (result?.error ?? "Failed");
    el.vResult.title = el.vResult.textContent;
    el.vResult.dataset.kind = result?.ok ? "ok" : "error";
});

el.sync.addEventListener("click", async () => {
    if (tabId == null) return;
    const result = await send<JumpResult>({ type: "sync-now", tabId });
    if (!result) say("Something went wrong. Check the extension's console.", "error");
    else if (!result.ok) say(result.error, "error");
    else say(`Discord → ${fmtTime(result.targetMs)}${status?.settings.target === "vencord" ? " (desktop)" : ""}`);
    await refresh();
});

el.stop.addEventListener("click", async () => {
    if (tabId == null) return;
    await send({ type: "stop", tabId });
    say("Stopped syncing this tab.");
    await refresh();
});

/**
 * Firefox lets users switch off an add-on's site access (and older versions
 * didn't grant it at install). Without it the content scripts never run.
 */
const SITE_ACCESS = { origins: ["https://www.youtube.com/*", "https://*.discord.com/*", "http://127.0.0.1/*"] };

el.grant.addEventListener("click", () => {
    // Must be called straight from the click. Firefox may close the popup while asking.
    void browser.permissions.request(SITE_ACCESS).then(granted => {
        el.access.hidden = granted;
        if (granted) say("Access allowed. Reload the YouTube tab.");
    });
});

async function start() {
    el.access.hidden = await browser.permissions.contains(SITE_ACCESS);
    if (!import.meta.env.FIREFOX) fileAccess = await browser.extension.isAllowedFileSchemeAccess();
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    await refresh();
    setInterval(refresh, 1000);
}

void start();
