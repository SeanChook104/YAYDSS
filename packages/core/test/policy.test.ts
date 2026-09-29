import { describe, expect, it } from "vitest";
import { decideJump, INITIAL_JUMP_STATE, MIN_INTERVAL_MS, recordJump, SEEK_DRIFT_MS } from "../src/policy";

const NOW = 1_000_000;
const T = Date.UTC(2026, 8, 1, 12);
const auto = { mode: "url" as const, auto: true };

describe("decideJump", () => {
    it("manual always jumps, even when paused or auto is off", () => {
        const e = { reason: "manual" as const, targetMs: T, videoPaused: true };
        expect(decideJump(recordJump(T, NOW), e, NOW, { mode: "url", auto: false })).toBe(true);
    });

    it("never auto-jumps while paused or with auto off", () => {
        const e = { reason: "interval" as const, targetMs: T, videoPaused: true };
        expect(decideJump(INITIAL_JUMP_STATE, e, NOW, auto)).toBe(false);
        expect(decideJump(INITIAL_JUMP_STATE, { ...e, videoPaused: false }, NOW, { ...auto, auto: false })).toBe(false);
    });

    it("interval waits for the mode's minimum gap", () => {
        const state = recordJump(T, NOW);
        const e = { reason: "interval" as const, targetMs: T + 5000, videoPaused: false };
        expect(decideJump(state, e, NOW + MIN_INTERVAL_MS.url - 1, auto)).toBe(false);
        expect(decideJump(state, e, NOW + MIN_INTERVAL_MS.url, auto)).toBe(true);
        expect(decideJump(state, e, NOW + MIN_INTERVAL_MS.vencord, { mode: "vencord", auto: true })).toBe(true);
    });

    it("first interval tick jumps", () => {
        const e = { reason: "interval" as const, targetMs: T, videoPaused: false };
        expect(decideJump(INITIAL_JUMP_STATE, e, NOW, auto)).toBe(true);
    });

    it("seek only jumps when the target moved far enough", () => {
        const state = recordJump(T, NOW);
        const near = { reason: "seek" as const, targetMs: T + SEEK_DRIFT_MS, videoPaused: false };
        const far = { ...near, targetMs: T - SEEK_DRIFT_MS - 1 };
        expect(decideJump(state, near, NOW + 1, auto)).toBe(false);
        expect(decideJump(state, far, NOW + 1, auto)).toBe(true);
    });
});
