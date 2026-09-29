import type { JumpReason } from "./policy";
import { isSnowflake } from "./snowflake";

/** Bump when Tick changes shape. The Vencord plugin rejects other versions. */
export const PROTOCOL_VERSION = 1;

/** One "please show this moment" message: extension → Vencord plugin. */
export interface Tick {
    v: typeof PROTOCOL_VERSION;
    /** Increases with every tick; stale ones are dropped. */
    seq: number;
    /** Unix ms when the extension sent it. */
    sentAt: number;
    videoId: string;
    guildId: string;
    channelId: string;
    /** Snowflake computed from `realMs`. */
    messageId: string;
    realMs: number;
    reason: JumpReason;
}

const REASONS: readonly string[] = ["manual", "seek", "play", "interval"];

export function isTick(x: unknown): x is Tick {
    if (typeof x !== "object" || x === null) return false;
    const t = x as Record<string, unknown>;
    return (
        t.v === PROTOCOL_VERSION &&
        Number.isSafeInteger(t.seq) &&
        Number.isFinite(t.sentAt) &&
        typeof t.videoId === "string" &&
        typeof t.guildId === "string" &&
        (t.guildId === "@me" || isSnowflake(t.guildId)) &&
        typeof t.channelId === "string" &&
        isSnowflake(t.channelId) &&
        typeof t.messageId === "string" &&
        isSnowflake(t.messageId) &&
        Number.isFinite(t.realMs) &&
        typeof t.reason === "string" &&
        REASONS.includes(t.reason)
    );
}
