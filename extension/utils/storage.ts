import { storage } from "#imports";
import { DEFAULT_SETTINGS, type Settings, type TabLink, type VideoMemory } from "./types";

const settingsItem = storage.defineItem<Partial<Settings>>("local:settings", { fallback: {} });

/** Saved settings on top of the defaults (older saves may miss newer fields). */
export async function getSettings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
    await settingsItem.setValue({ ...(await getSettings()), ...patch });
}

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

/** Change what's remembered for a video, dropping the oldest entries past 200 videos. */
export async function updateVideoMemory(videoId: string, patch: Partial<Omit<VideoMemory, "updatedAt">>): Promise<void> {
    const all = await videoMemoryItem.getValue();
    all[videoId] = { offsetMs: 0, ...all[videoId], ...patch, updatedAt: Date.now() };

    const ids = Object.keys(all);
    if (ids.length > MAX_VIDEOS) {
        ids.sort((a, b) => (all[a]?.updatedAt ?? 0) - (all[b]?.updatedAt ?? 0))
            .slice(0, ids.length - MAX_VIDEOS)
            .forEach(id => delete all[id]);
    }
    await videoMemoryItem.setValue(all);
}
