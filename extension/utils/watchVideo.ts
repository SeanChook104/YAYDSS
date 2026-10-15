import type { ContentScriptContext } from "#imports";
import type { BackgroundMessage, ContentMessage, ReportReason, VideoReport } from "./types";

const HEARTBEAT_MS = 2000;
/** Dragging the seek bar fires several "seeked" events; only send the last one. */
const SEEK_DEBOUNCE_MS = 800;

/**
 * Watch a <video> and report its position to the background:
 * on play/pause/seek and every 2 s. Also answers the background's "get-report".
 * Shared by the YouTube and the local-file content scripts.
 *
 * Returns `attach`, to call when the page may have swapped its <video>.
 */
export function watchVideo(
    ctx: ContentScriptContext,
    findVideo: () => HTMLVideoElement | null,
    buildReport: (video: HTMLVideoElement) => VideoReport | null
): () => void {
    let video: HTMLVideoElement | null = null;
    let seekTimer: ReturnType<typeof setTimeout> | undefined;

    const report = () => (video ? buildReport(video) : null);

    async function send(reason: ReportReason) {
        if (ctx.isInvalid) return;
        const r = report();
        if (!r) return;
        try {
            await browser.runtime.sendMessage({ type: "yt-report", reason, report: r } satisfies BackgroundMessage);
        } catch {
            // background not ready, or the extension was reloaded
        }
    }

    const onPlay = () => send("play");
    const onPause = () => send("pause");
    const onSeeked = () => {
        clearTimeout(seekTimer);
        seekTimer = setTimeout(() => send("seek"), SEEK_DEBOUNCE_MS);
    };

    function detach() {
        video?.removeEventListener("play", onPlay);
        video?.removeEventListener("pause", onPause);
        video?.removeEventListener("seeked", onSeeked);
    }

    function attach() {
        const v = findVideo();
        if (v === video) return;
        detach();
        video = v;
        video?.addEventListener("play", onPlay);
        video?.addEventListener("pause", onPause);
        video?.addEventListener("seeked", onSeeked);
    }

    browser.runtime.onMessage.addListener((msg: ContentMessage, _sender, sendResponse) => {
        if (msg?.type !== "get-report") return;
        attach();
        sendResponse(report());
    });

    ctx.setInterval(() => {
        attach();
        void send("heartbeat");
    }, HEARTBEAT_MS);
    ctx.onInvalidated(() => {
        clearTimeout(seekTimer);
        detach();
    });

    attach();
    return attach;
}
