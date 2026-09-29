/**
 * Real-world time (Unix ms) that the VOD is showing.
 * A positive `offsetMs` shows later chat (e.g. to make up for stream delay).
 */
export function realMs(streamStartMs: number, vodSeconds: number, offsetMs = 0): number {
    return streamStartMs + vodSeconds * 1000 + offsetMs;
}

/**
 * "Calibrate": the offset that makes VOD position `vodSeconds` line up with
 * a message the user recognises (its time comes from `msFromSnowflake`).
 */
export function offsetFromCalibration(streamStartMs: number, vodSeconds: number, messageMs: number): number {
    return Math.round(messageMs - (streamStartMs + vodSeconds * 1000));
}
