/** How the Discord side is moved. */
export type JumpMode =
    /** Change the Discord tab's URL (reloads the page). */
    | "url"
    /** In-page navigation via history.pushState (experimental). */
    | "soft"
    /** Vencord plugin jumps in-app. */
    | "vencord";

export type JumpReason = "manual" | "seek" | "play" | "interval";

/** Minimum gap between automatic jumps, per mode. URL jumps reload Discord, so they are rare. */
export const MIN_INTERVAL_MS: Record<JumpMode, number> = {
    url: 60_000,
    soft: 10_000,
    // The plugin jumps in-app and skips repeats, so follow closely (heartbeat is 2 s).
    vencord: 1_500
};

/** A seek (or play) only jumps if the target moved at least this far. */
export const SEEK_DRIFT_MS = 15_000;

export interface JumpState {
    lastJumpAt: number | null;
    lastTargetMs: number | null;
}

export interface JumpEvent {
    reason: JumpReason;
    /** Real-world time we want Discord to show. */
    targetMs: number;
    videoPaused: boolean;
}

export interface JumpOptions {
    mode: JumpMode;
    /** Auto-sync on. When off, only manual jumps happen. */
    auto: boolean;
}

export const INITIAL_JUMP_STATE: JumpState = { lastJumpAt: null, lastTargetMs: null };

export function decideJump(state: JumpState, event: JumpEvent, now: number, opts: JumpOptions): boolean {
    if (event.reason === "manual") return true;
    if (!opts.auto || event.videoPaused) return false;

    if (event.reason === "seek" || event.reason === "play") {
        return state.lastTargetMs == null || Math.abs(event.targetMs - state.lastTargetMs) > SEEK_DRIFT_MS;
    }

    // interval
    return state.lastJumpAt == null || now - state.lastJumpAt >= MIN_INTERVAL_MS[opts.mode];
}

export function recordJump(targetMs: number, now: number): JumpState {
    return { lastJumpAt: now, lastTargetMs: targetMs };
}
