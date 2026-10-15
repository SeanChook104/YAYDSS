import type { BroadcastInfo, DiscordChannel, JumpState, StartChoice } from "@yaydss/core";

/** What youtube-main.content.ts reads from YouTube's player (or the JSON-LD fallback), or a local file's name. */
export interface VideoFacts {
    videoId: string;
    title: string;
    author: string;
    lengthSeconds: number | null;
    /** null = not a livestream / premiere. */
    broadcast: BroadcastInfo | null;
    source: "player" | "json-ld" | "file";
}

/** Snapshot the YouTube / file content script sends to the background. */
export interface VideoReport {
    videoId: string;
    facts: VideoFacts | null;
    /** VOD position in seconds. */
    currentTime: number;
    /** <video>.duration in seconds (null during ads). Backup for facts.lengthSeconds. */
    duration: number | null;
    paused: boolean;
    /** An ad is playing: currentTime is the ad's, not the VOD's. */
    ad: boolean;
    at: number;
}

export type ReportReason = "heartbeat" | "play" | "pause" | "seek";

/** Remembered per video (or file): which channel it syncs to, the offset, and a lined-up start. */
export interface VideoMemory {
    channel?: DiscordChannel;
    /** Tab title when the channel was picked, just for display. */
    channelLabel?: string;
    offsetMs: number;
    /** Real time of this video's 0:00 when it was lined up with a YouTube VOD (local files). */
    startMs?: number;
    /** What the user typed to line it up, to show it again. */
    lineUp?: { youtubeUrl: string; youtubeSeconds: number; videoSeconds: number };
    updatedAt: number;
}

export interface Settings {
    /** Jump automatically (on play/seek and on an interval). Off = only "Sync now". */
    auto: boolean;
    /** "tab" = change a Discord browser tab's URL; "vencord" = send to the plugin in Discord desktop. */
    target: "tab" | "vencord";
    vencordPort: number;
    vencordToken: string;
}

export const DEFAULT_SETTINGS: Settings = {
    auto: true,
    target: "tab",
    vencordPort: 47810,
    vencordToken: ""
};

/** A YouTube tab that is syncing. Lives in session storage. */
export interface TabLink {
    enabled: boolean;
    discordTabId: number | null;
    jump: JumpState;
}

export type JumpResult =
    | { ok: true; jumped: boolean; targetMs: number }
    | { ok: false; error: string };

/** Everything the popup shows. */
export interface Status {
    report: VideoReport | null;
    memory: VideoMemory | null;
    choice: StartChoice | null;
    /** Real time of the video's 0:00, from YouTube or from lining up. */
    startMs: number | null;
    startSource: "youtube" | "lined-up" | null;
    targetMs: number | null;
    link: TabLink | null;
    settings: Settings;
    /** Why we can't jump right now, if anything. */
    problem: string | null;
}

/** Messages to the background. */
export type BackgroundMessage =
    | { type: "yt-report"; reason: ReportReason; report: VideoReport }
    | { type: "get-status"; tabId: number }
    | { type: "sync-now"; tabId: number }
    | { type: "stop"; tabId: number }
    | { type: "test-vencord" }
    | { type: "line-up"; videoId: string; youtubeUrl: string; youtubeSeconds: number; videoSeconds: number };

export type TestResult = { ok: true } | { ok: false; error: string };

export type LineUpResult = { ok: true; startMs: number; youtubeStartMs: number } | { ok: false; error: string };

/** Messages to the YouTube content script. */
export type ContentMessage = { type: "get-report" };

/** window.postMessage tags between the two YouTube scripts. */
export const FROM_MAIN = "yaydss:main";
export const FROM_ISOLATED = "yaydss:isolated";
