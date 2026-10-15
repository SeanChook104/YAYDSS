import { youtubeVideoIdFromUrl } from "@yaydss/core";
import { FROM_ISOLATED, FROM_MAIN, type VideoFacts } from "@/utils/types";
import { watchVideo } from "@/utils/watchVideo";

/**
 * Watches the YouTube player and reports the VOD position to the background.
 * It only reports facts; the background does all the maths.
 */
export default defineContentScript({
    matches: ["https://www.youtube.com/*"],
    main(ctx) {
        let facts: VideoFacts | null = null;

        const requestFacts = () => window.postMessage({ source: FROM_ISOLATED, type: "request-facts" }, location.origin);

        // Answers from youtube-main.content.ts
        window.addEventListener("message", e => {
            if (ctx.isInvalid || e.origin !== location.origin || e.data?.source !== FROM_MAIN) return;
            try {
                const f = JSON.parse(e.data.json) as VideoFacts | null;
                if (f?.videoId) facts = f;
            } catch {
                // ignore malformed messages
            }
        });

        function currentFacts(videoId: string): VideoFacts | null {
            if (facts?.videoId === videoId) return facts;
            requestFacts(); // player data not here yet (or stale): ask, and use JSON-LD meanwhile
            return jsonLdFacts(videoId);
        }

        const attach = watchVideo(
            ctx,
            () => document.querySelector<HTMLVideoElement>("#movie_player video"),
            video => {
                const videoId = youtubeVideoIdFromUrl(location.href);
                if (!videoId) return null;
                const ad = document.getElementById("movie_player")?.classList.contains("ad-showing") ?? false;
                return {
                    videoId,
                    facts: currentFacts(videoId),
                    currentTime: video.currentTime,
                    duration: !ad && Number.isFinite(video.duration) ? video.duration : null,
                    paused: video.paused,
                    ad,
                    at: Date.now()
                };
            }
        );

        document.addEventListener("yt-navigate-finish", () => {
            if (ctx.isInvalid) return;
            facts = null;
            requestFacts();
            attach();
        });

        requestFacts();
    }
});

/** Fallback: the JSON-LD block YouTube puts in the page for search engines. */
function jsonLdFacts(videoId: string): VideoFacts | null {
    const el = document.querySelector('#microformat script[type="application/ld+json"]');
    if (!el?.textContent) return null;
    try {
        const data = JSON.parse(el.textContent);
        if (!String(data["@id"] ?? "").includes(videoId)) return null; // stale, from the previous video
        const pub = Array.isArray(data.publication) ? data.publication[0] : null;
        return {
            videoId,
            title: typeof data.name === "string" ? data.name : "",
            author: typeof data.author === "string" ? data.author : "",
            lengthSeconds: null,
            broadcast: pub
                ? {
                      startTimestamp: pub.startDate ?? null,
                      endTimestamp: pub.endDate ?? null,
                      // No end date yet = still live.
                      isLiveNow: !pub.endDate
                  }
                : null,
            source: "json-ld"
        };
    } catch {
        return null;
    }
}
