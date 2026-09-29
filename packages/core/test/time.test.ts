import { describe, expect, it } from "vitest";
import { offsetFromCalibration, realMs } from "../src/time";

const START = Date.UTC(2026, 8, 1, 12);

describe("realMs", () => {
    it("adds VOD seconds and offset", () => {
        expect(realMs(START, 0)).toBe(START);
        expect(realMs(START, 90.5)).toBe(START + 90_500);
        expect(realMs(START, 90, 3000)).toBe(START + 93_000);
        expect(realMs(START, 90, -3000)).toBe(START + 87_000);
    });
});

describe("offsetFromCalibration", () => {
    it("gives the offset that lines the VOD up with a known message", () => {
        const messageMs = START + 125_000; // message really sent at 2:05
        const offset = offsetFromCalibration(START, 120, messageMs); // user sees it at VOD 2:00
        expect(offset).toBe(5000);
        expect(realMs(START, 120, offset)).toBe(messageMs);
    });
});
