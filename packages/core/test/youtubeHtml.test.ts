import { describe, expect, it } from "vitest";
import { parseWatchPage } from "../src/youtubeHtml";

// Trimmed shape of a real watch page (ytInitialPlayerResponse inside a <script>).
const page = (details: string, extra = "") =>
    `<html><script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"wK0cKEVi9A4","lengthSeconds":"1834","isLiveContent":true${extra}},` +
    `"microformat":{"playerMicroformatRenderer":{"lengthSeconds":"1834",${details}"publishDate":"2026-10-01"}}};</script></html>`;

describe("parseWatchPage", () => {
    it("reads a livestream VOD", () => {
        const info = parseWatchPage(
            page('"liveBroadcastDetails":{"isLiveNow":false,"startTimestamp":"2026-10-01T10:00:00+00:00","endTimestamp":"2026-10-01T10:30:35+00:00"},')
        );
        expect(info).toEqual({
            lengthSeconds: 1834,
            broadcast: {
                startTimestamp: "2026-10-01T10:00:00+00:00",
                endTimestamp: "2026-10-01T10:30:35+00:00",
                isLiveNow: false,
                isLiveContent: true
            }
        });
    });

    it("normal video: no broadcast", () => {
        expect(parseWatchPage(page("")).broadcast).toBeNull();
    });

    it("garbage: nothing", () => {
        expect(parseWatchPage("<html>consent page</html>")).toEqual({ broadcast: null, lengthSeconds: null });
    });
});
