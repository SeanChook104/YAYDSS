import type { BroadcastInfo } from "./youtubeStart";

export interface WatchPageInfo {
    broadcast: BroadcastInfo | null;
    lengthSeconds: number | null;
}

/**
 * Read the stream times from the HTML of a YouTube watch page
 * (the ytInitialPlayerResponse embedded in it). Used when the video isn't
 * open in a tab, e.g. to line a local file up with it.
 */
export function parseWatchPage(html: string): WatchPageInfo {
    let broadcast: BroadcastInfo | null = null;

    const details = /"liveBroadcastDetails":(\{[^{}]*\})/.exec(html)?.[1];
    if (details) {
        try {
            const d = JSON.parse(details) as Record<string, unknown>;
            const isLiveContent = /"isLiveContent":(true|false)/.exec(html)?.[1];
            broadcast = {
                startTimestamp: typeof d.startTimestamp === "string" ? d.startTimestamp : null,
                endTimestamp: typeof d.endTimestamp === "string" ? d.endTimestamp : null,
                isLiveNow: d.isLiveNow === true,
                isLiveContent: isLiveContent ? isLiveContent === "true" : undefined
            };
        } catch {
            broadcast = null;
        }
    }

    const length = /"lengthSeconds":"(\d+)"/.exec(html)?.[1];
    return { broadcast, lengthSeconds: length ? Number(length) : null };
}
