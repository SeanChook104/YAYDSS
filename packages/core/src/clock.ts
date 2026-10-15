/**
 * Read a video time typed by a person: "75", "1:15", "1:02:03" or "1:15.5".
 * Returns seconds, or null if it doesn't look like a time.
 */
export function parseClock(input: string): number | null {
    const parts = input.trim().split(":");
    if (parts.length > 3 || parts.some(p => !/^\d+(\.\d+)?$/.test(p))) return null;
    const nums = parts.map(Number);
    // Only the last part may have decimals, and minutes/seconds after the first part must be < 60.
    if (nums.slice(0, -1).some(n => !Number.isInteger(n)) || nums.slice(1).some(n => n >= 60)) return null;
    return nums.reduce((total, n) => total * 60 + n, 0);
}

/** Seconds → "1:02:03" or "2:03". */
export function formatClock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/**
 * Real-world time of a video's 0:00, found by matching one moment that appears
 * in both it and a YouTube VOD (e.g. the first song starts at 12:40 on YouTube
 * and at 15:05 in the file).
 */
export function lineUpStart(youtubeStartMs: number, youtubeSeconds: number, otherSeconds: number): number {
    return youtubeStartMs + (youtubeSeconds - otherSeconds) * 1000;
}
