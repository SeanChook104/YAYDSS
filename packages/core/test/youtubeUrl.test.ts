import { describe, expect, it } from "vitest";
import { youtubeVideoIdFromUrl } from "../src/youtubeUrl";

const ID = "-SqrxwHyfEE";

describe("youtubeVideoIdFromUrl", () => {
    it.each([
        `https://www.youtube.com/watch?v=${ID}`,
        `https://www.youtube.com/watch?v=${ID}&list=RD${ID}&start_radio=1`,
        `https://www.youtube.com/watch?t=90&v=${ID}`,
        `https://m.youtube.com/watch?v=${ID}`,
        `https://youtube.com/live/${ID}?si=abc`,
        `https://www.youtube.com/embed/${ID}`,
        `https://youtu.be/${ID}?t=10`
    ])("reads %s", url => {
        expect(youtubeVideoIdFromUrl(url)).toBe(ID);
    });

    it.each([
        "https://www.youtube.com/",
        "https://www.youtube.com/@SomeChannel/streams",
        "https://www.youtube.com/watch",
        "https://www.youtube.com/watch?v=short",
        `https://www.notyoutube.com/watch?v=${ID}`,
        "not a url"
    ])("ignores %s", url => {
        expect(youtubeVideoIdFromUrl(url)).toBeNull();
    });
});
