import { FROM_ISOLATED, FROM_MAIN, type VideoFacts } from "@/utils/types";

/**
 * Runs in YouTube's own page ("MAIN world") so it can call the player's
 * getPlayerResponse(). There are no extension APIs here: it only answers
 * youtube.content.ts through window.postMessage.
 *
 * getPlayerResponse() stays correct after in-page navigation;
 * window.ytInitialPlayerResponse does not.
 */
export default defineContentScript({
    matches: ["https://www.youtube.com/*"],
    world: "MAIN",
    main() {
        const post = () => {
            // JSON string so Firefox's content-script wrappers don't get in the way.
            window.postMessage({ source: FROM_MAIN, type: "facts", json: JSON.stringify(readFacts()) }, location.origin);
        };

        window.addEventListener("message", e => {
            if (e.origin === location.origin && e.data?.source === FROM_ISOLATED && e.data.type === "request-facts") post();
        });
        document.addEventListener("yt-navigate-finish", post);
    }
});

type PlayerElement = HTMLElement & { getPlayerResponse?: () => any };

function readFacts(): VideoFacts | null {
    const player = document.getElementById("movie_player") as PlayerElement | null;
    const pr = player?.getPlayerResponse?.();
    const details = pr?.videoDetails;
    if (!details?.videoId) return null;

    const live = pr.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
    return {
        videoId: details.videoId,
        title: String(details.title ?? ""),
        author: String(details.author ?? ""),
        lengthSeconds: Number(details.lengthSeconds) || null,
        broadcast: live
            ? {
                  startTimestamp: live.startTimestamp ?? null,
                  endTimestamp: live.endTimestamp ?? null,
                  isLiveNow: live.isLiveNow === true,
                  // true = livestream, false = premiere
                  isLiveContent: typeof details.isLiveContent === "boolean" ? details.isLiveContent : undefined,
                  isPostLiveDvr: details.isPostLiveDvr === true
              }
            : null,
        source: "player"
    };
}
