import { watchVideo } from "@/utils/watchVideo";

/**
 * A video file opened in the browser (drag the file into a tab).
 * Chrome needs "Allow access to file URLs" switched on for YAYDSS.
 *
 * Files have no stream times, so the popup's "Line up with YouTube"
 * gives them a start time, saved per file name.
 */
export default defineContentScript({
    matches: ["file:///*"],
    main(ctx) {
        const name = decodeURIComponent(location.pathname.split("/").pop() || "video");
        const videoId = `file:${name}`;

        watchVideo(
            ctx,
            () => document.querySelector("video"),
            video => {
                const duration = Number.isFinite(video.duration) ? video.duration : null;
                return {
                    videoId,
                    facts: { videoId, title: name, author: "Video file", lengthSeconds: duration, broadcast: null, source: "file" },
                    currentTime: video.currentTime,
                    duration,
                    paused: video.paused,
                    ad: false,
                    at: Date.now()
                };
            }
        );
    }
});
