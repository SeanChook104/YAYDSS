/** Discord's epoch (2015-01-01T00:00:00Z) in Unix milliseconds. */
export const DISCORD_EPOCH_MS = 1420070400000;

const EPOCH = BigInt(DISCORD_EPOCH_MS);

/**
 * The smallest snowflake that could exist at `ms` (Unix milliseconds).
 * Discord only looks at the timestamp bits, so this is enough to load
 * messages "around" a moment. Returns "0" for times before the epoch.
 *
 * Always BigInt: snowflakes are bigger than Number.MAX_SAFE_INTEGER.
 */
export function snowflakeFromMs(ms: number): string {
    if (!Number.isFinite(ms)) throw new RangeError(`snowflakeFromMs: not a finite number: ${ms}`);
    const whole = Math.floor(ms);
    if (whole <= DISCORD_EPOCH_MS) return "0";
    return ((BigInt(whole) - EPOCH) << 22n).toString();
}

/** Unix milliseconds encoded in a snowflake. */
export function msFromSnowflake(id: string | bigint): number {
    const big = typeof id === "bigint" ? id : BigInt(id);
    return Number((big >> 22n) + EPOCH);
}

/** Looks like a Discord ID (17–20 digits). */
export function isSnowflake(s: string): boolean {
    return /^\d{17,20}$/.test(s);
}
