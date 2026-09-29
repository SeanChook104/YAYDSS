import { storage } from "#imports";
import type { Settings, TabLink, VideoMemory } from "./types";

export const settingsItem = storage.defineItem<Settings>("local:settings", {
    fallback: { auto: true }
});

/** videoId → channel + offset. Only IDs and numbers, never message content. */
export const videoMemoryItem = storage.defineItem<Record<string, VideoMemory>>("local:videoMemory", {
    fallback: {}
});

/** YouTube tabId → sync state. Session storage survives the service worker restarting. */
export const linksItem = storage.defineItem<Record<string, TabLink>>("session:links", {
    fallback: {}
});

const MAX_VIDEOS = 200;

export async function getVideoMemory(videoId: string): Promise<VideoMemory | null> {
    return (await videoMemoryItem.getValue())[videoId] ?? null;
}

/** Save a video's channel/offset, dropping the oldest entries past 200 videos. */
export async function saveVideoMemory(videoId: string, memory: Omit<VideoMemory, "updatedAt">): Promise<void> {
    const all = await videoMemoryItem.getValue();
    all[videoId] = { ...memory, updatedAt: Date.now() };

    const ids = Object.keys(all);
    if (ids.length > MAX_VIDEOS) {
        ids.sort((a, b) => (all[a]?.updatedAt ?? 0) - (all[b]?.updatedAt ?? 0))
            .slice(0, ids.length - MAX_VIDEOS)
            .forEach(id => delete all[id]);
    }
    await videoMemoryItem.setValue(all);
}
