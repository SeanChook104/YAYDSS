import { describe, expect, it } from "vitest";
import { formatClock, lineUpStart, parseClock } from "../src/clock";

describe("parseClock", () => {
    it.each([
        ["75", 75],
        ["1:15", 75],
        ["01:15", 75],
        ["1:02:03", 3723],
        ["12:40.5", 760.5],
        ["  0:00 ", 0]
    ])("reads %s", (input, seconds) => {
        expect(parseClock(input)).toBe(seconds);
    });

    it.each(["", "abc", "1:60", "1:2:3:4", "-5", "1.5:00", "1::2"])("rejects %s", input => {
        expect(parseClock(input)).toBeNull();
    });
});

describe("formatClock", () => {
    it("formats", () => {
        expect(formatClock(0)).toBe("0:00");
        expect(formatClock(75.9)).toBe("1:15");
        expect(formatClock(3723)).toBe("1:02:03");
        expect(formatClock(-3)).toBe("0:00");
    });
});

describe("lineUpStart", () => {
    it("works out the file's 0:00 from one shared moment", () => {
        const ytStart = Date.UTC(2026, 9, 1, 10);
        // First song: 12:40 on YouTube, 15:05 in the file → the file started 2:25 earlier.
        const fileStart = lineUpStart(ytStart, 760, 905);
        expect(fileStart).toBe(ytStart - 145_000);
        // The same moment gives the same real time from either video.
        expect(fileStart + 905_000).toBe(ytStart + 760_000);
    });
});
