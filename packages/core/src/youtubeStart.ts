/**
 * Facts about a video's broadcast, as read from YouTube's player response:
 * - videoDetails.isLiveContent
 * - microformat.playerMicroformatRenderer.liveBroadcastDetails.{startTimestamp,endTimestamp,isLiveNow}
 * - videoDetails.isPostLiveDvr (VOD still being processed)
 * The JSON-LD fallback only gives start/end; `isLiveContent` is then unknown.
 */
export interface BroadcastInfo {
    /** ISO string or Unix ms. */
    startTimestamp?: string | number | null;
    endTimestamp?: string | number | null;
    isLiveNow?: boolean;
    /** true = was a livestream, false = premiere, undefined = unknown. */
    isLiveContent?: boolean;
    isPostLiveDvr?: boolean;
}

export type StartKind = "livestream" | "premiere" | "live-now" | "not-live";

/** Which candidate was used as VOD 0:00. */
export type StartAnchor = "start" | "end-minus-duration";

export type StartWarning =
    /** VOD is shorter than the broadcast (trimmed start, or a stream over 12 h). */
    | "vod-shorter-than-broadcast"
    /** YouTube is still processing the VOD; times may be off. */
    | "processing"
    /** The preferred candidate was missing, so the other one was used. */
    | "fallback-anchor";

export interface StartChoice {
    kind: StartKind;
    /** Real-world time of VOD 0:00, or null if we can't sync. */
    startMs: number | null;
    anchor: StartAnchor | null;
    warnings: StartWarning[];
    candidates: { start: number | null; endMinusDuration: number | null };
}

/** How much shorter the VOD may be than the broadcast before we distrust `startTimestamp`. */
export const TRIM_THRESHOLD_MS = 60_000;

function toMs(t: string | number | null | undefined): number | null {
    if (t == null || t === "") return null;
    const ms = typeof t === "number" ? t : Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * Pick the real-world time of VOD 0:00.
 *
 * Candidate A = startTimestamp, B = endTimestamp − duration.
 * - Premiere → B (its startTimestamp includes the countdown).
 * - VOD more than 60 s shorter than the broadcast → B, with a warning.
 *   (This also catches premieres when `isLiveContent` is unknown.)
 * - Otherwise → A. B runs late on normal livestreams.
 */
export function chooseStart(info: BroadcastInfo | null | undefined, durationS: number | null | undefined): StartChoice {
    const start = toMs(info?.startTimestamp);
    const end = toMs(info?.endTimestamp);
    const endMinusDuration = end != null && durationS != null && durationS > 0 ? end - durationS * 1000 : null;
    const candidates = { start, endMinusDuration };
    const warnings: StartWarning[] = [];

    if (!info || (start == null && end == null)) {
        return { kind: "not-live", startMs: null, anchor: null, warnings, candidates };
    }
    if (info.isLiveNow) {
        return { kind: "live-now", startMs: null, anchor: null, warnings, candidates };
    }
    if (info.isPostLiveDvr) warnings.push("processing");

    const kind: StartKind = info.isLiveContent === false ? "premiere" : "livestream";
    const pick = (anchor: StartAnchor, extra?: StartWarning): StartChoice => {
        if (extra) warnings.push(extra);
        return {
            kind,
            startMs: anchor === "start" ? start : endMinusDuration,
            anchor,
            warnings,
            candidates
        };
    };

    if (kind === "premiere") {
        return endMinusDuration != null ? pick("end-minus-duration") : pick("start", "fallback-anchor");
    }
    if (start != null && endMinusDuration != null && endMinusDuration - start > TRIM_THRESHOLD_MS) {
        return pick("end-minus-duration", "vod-shorter-than-broadcast");
    }
    if (start != null) return pick("start");
    if (endMinusDuration != null) return pick("end-minus-duration", "fallback-anchor");

    // Only an end time and no duration: nothing to anchor on.
    return { kind, startMs: null, anchor: null, warnings, candidates };
}
