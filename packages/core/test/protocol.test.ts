import { describe, expect, it } from "vitest";
import { isTick, PROTOCOL_VERSION, type Tick } from "../src/protocol";

const tick: Tick = {
    v: PROTOCOL_VERSION,
    seq: 1,
    sentAt: Date.now(),
    videoId: "dQw4w9WgXcQ",
    guildId: "123456789012345678",
    channelId: "234567890123456789",
    messageId: "175928847298985984",
    realMs: 1462015105796,
    reason: "interval"
};

describe("isTick", () => {
    it("accepts a valid tick", () => {
        expect(isTick(tick)).toBe(true);
        expect(isTick({ ...tick, guildId: "@me" })).toBe(true);
    });

    it.each([
        ["null", null],
        ["string", "tick"],
        ["wrong version", { ...tick, v: 2 }],
        ["float seq", { ...tick, seq: 1.5 }],
        ["bad channel", { ...tick, channelId: "abc" }],
        ["bad message", { ...tick, messageId: "0" }],
        ["numeric message id", { ...tick, messageId: 175928847298985984 }],
        ["bad reason", { ...tick, reason: "hack" }],
        ["NaN realMs", { ...tick, realMs: NaN }]
    ])("rejects %s", (_, x) => {
        expect(isTick(x)).toBe(false);
    });
});
