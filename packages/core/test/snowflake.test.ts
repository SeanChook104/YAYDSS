import { describe, expect, it } from "vitest";
import { DISCORD_EPOCH_MS, isSnowflake, msFromSnowflake, snowflakeFromMs } from "../src/snowflake";

// Example pair from https://docs.discord.com/developers/reference (Snowflakes).
const DOCS_ID = "175928847299117063";
const DOCS_MS = 1462015105796;

describe("snowflake", () => {
    it("reads the time from Discord's documented example ID", () => {
        expect(msFromSnowflake(DOCS_ID)).toBe(DOCS_MS);
        expect(msFromSnowflake(BigInt(DOCS_ID))).toBe(DOCS_MS);
    });

    it("builds the smallest ID for that time (worker/process/increment bits are 0)", () => {
        expect(snowflakeFromMs(DOCS_MS)).toBe("175928847298985984");
    });

    it("round-trips any whole millisecond", () => {
        for (const ms of [DOCS_MS, Date.UTC(2026, 8, 1, 12), Date.UTC(2099, 0, 1)]) {
            expect(msFromSnowflake(snowflakeFromMs(ms))).toBe(ms);
        }
    });

    it("stays exact beyond Number.MAX_SAFE_INTEGER", () => {
        const id = snowflakeFromMs(Date.UTC(2026, 8, 1, 12));
        expect(BigInt(id) > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(BigInt(id) & ((1n << 22n) - 1n)).toBe(0n);
        // Float maths would lose the low bits and fail this round trip.
        expect(msFromSnowflake(BigInt(id) + 1n)).toBe(Date.UTC(2026, 8, 1, 12));
    });

    it("floors fractional milliseconds", () => {
        expect(snowflakeFromMs(DOCS_MS + 0.9)).toBe(snowflakeFromMs(DOCS_MS));
        expect(snowflakeFromMs(1.5 + DISCORD_EPOCH_MS)).toBe((1n << 22n).toString());
    });

    it("rejects NaN and Infinity", () => {
        expect(() => snowflakeFromMs(NaN)).toThrow(RangeError);
        expect(() => snowflakeFromMs(Infinity)).toThrow(RangeError);
    });

    it("returns 0 for times at or before the Discord epoch", () => {
        expect(snowflakeFromMs(DISCORD_EPOCH_MS)).toBe("0");
        expect(snowflakeFromMs(0)).toBe("0");
    });

    it("recognises IDs", () => {
        expect(isSnowflake(DOCS_ID)).toBe(true);
        expect(isSnowflake("0")).toBe(false);
        expect(isSnowflake("12345abc")).toBe(false);
        expect(isSnowflake("")).toBe(false);
    });
});
