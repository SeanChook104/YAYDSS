import { describe, expect, it } from "vitest";
import { chooseStart, TRIM_THRESHOLD_MS } from "../src/youtubeStart";

const START = Date.UTC(2026, 8, 1, 12);
const iso = (ms: number) => new Date(ms).toISOString();
const HOUR_S = 3600;

describe("chooseStart", () => {
    it("normal livestream → startTimestamp", () => {
        // Broadcast 1 h; VOD 1 h minus a few seconds of processing slack.
        const r = chooseStart(
            { startTimestamp: iso(START), endTimestamp: iso(START + HOUR_S * 1000), isLiveContent: true },
            HOUR_S - 5
        );
        expect(r).toMatchObject({ kind: "livestream", startMs: START, anchor: "start", warnings: [] });
    });

    it("premiere → end − duration (startTimestamp includes the countdown)", () => {
        const realStart = START + 120_000; // 2 min countdown
        const r = chooseStart(
            { startTimestamp: iso(START), endTimestamp: iso(realStart + HOUR_S * 1000), isLiveContent: false },
            HOUR_S
        );
        expect(r).toMatchObject({ kind: "premiere", startMs: realStart, anchor: "end-minus-duration" });
    });

    it("trimmed start → end − duration with a warning", () => {
        const trimmed = 10 * 60; // streamer cut the first 10 min
        const r = chooseStart(
            { startTimestamp: iso(START), endTimestamp: iso(START + HOUR_S * 1000), isLiveContent: true },
            HOUR_S - trimmed
        );
        expect(r.startMs).toBe(START + trimmed * 1000);
        expect(r.warnings).toContain("vod-shorter-than-broadcast");
    });

    it("stream over 12 h where only the last 12 h were kept → end − duration", () => {
        const r = chooseStart(
            { startTimestamp: iso(START), endTimestamp: iso(START + 14 * HOUR_S * 1000), isLiveContent: true },
            12 * HOUR_S
        );
        expect(r.startMs).toBe(START + 2 * HOUR_S * 1000);
        expect(r.warnings).toContain("vod-shorter-than-broadcast");
    });

    it("difference at the threshold still trusts startTimestamp", () => {
        const r = chooseStart(
            { startTimestamp: iso(START), endTimestamp: iso(START + HOUR_S * 1000 + TRIM_THRESHOLD_MS) },
            HOUR_S
        );
        expect(r.anchor).toBe("start");
    });

    it("isLiveContent unknown (JSON-LD fallback) still catches a premiere via the length check", () => {
        const realStart = START + 120_000;
        const r = chooseStart({ startTimestamp: iso(START), endTimestamp: iso(realStart + HOUR_S * 1000) }, HOUR_S);
        expect(r).toMatchObject({ kind: "livestream", startMs: realStart, anchor: "end-minus-duration" });
    });

    it("accepts Unix ms as well as ISO strings", () => {
        expect(chooseStart({ startTimestamp: START }, HOUR_S).startMs).toBe(START);
    });

    it("missing end → startTimestamp", () => {
        expect(chooseStart({ startTimestamp: iso(START), isLiveContent: true }, HOUR_S)).toMatchObject({
            startMs: START,
            anchor: "start"
        });
    });

    it("premiere without end → startTimestamp with a warning", () => {
        const r = chooseStart({ startTimestamp: iso(START), isLiveContent: false }, HOUR_S);
        expect(r).toMatchObject({ kind: "premiere", startMs: START, anchor: "start" });
        expect(r.warnings).toContain("fallback-anchor");
    });

    it("missing start → end − duration with a warning", () => {
        const r = chooseStart({ endTimestamp: iso(START + HOUR_S * 1000), isLiveContent: true }, HOUR_S);
        expect(r).toMatchObject({ startMs: START, anchor: "end-minus-duration" });
        expect(r.warnings).toContain("fallback-anchor");
    });

    it("still live → not supported", () => {
        const r = chooseStart({ startTimestamp: iso(START), isLiveNow: true, isLiveContent: true }, 0);
        expect(r).toMatchObject({ kind: "live-now", startMs: null });
    });

    it("VOD still processing → warning", () => {
        const r = chooseStart({ startTimestamp: iso(START), isPostLiveDvr: true, isLiveContent: true }, HOUR_S);
        expect(r.startMs).toBe(START);
        expect(r.warnings).toContain("processing");
    });

    it("normal video / no data → not-live", () => {
        expect(chooseStart(null, 100).kind).toBe("not-live");
        expect(chooseStart({}, 100).kind).toBe("not-live");
        expect(chooseStart({ startTimestamp: "garbage" }, 100).kind).toBe("not-live");
    });

    it("end only and no duration → can't anchor", () => {
        const r = chooseStart({ endTimestamp: iso(START) }, 0);
        expect(r.startMs).toBeNull();
    });
});
