const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Video ID from a YouTube link: /watch?v=ID, /live/ID, /shorts/ID, /embed/ID or youtu.be/ID.
 * Returns null for anything else (home page, channel pages, other sites).
 */
export function youtubeVideoIdFromUrl(input: string): string | null {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    let id: string | null = null;

    if (host === "youtu.be") {
        id = url.pathname.split("/")[1] ?? null;
    } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
        if (url.pathname === "/watch") {
            id = url.searchParams.get("v");
        } else {
            id = /^\/(?:live|shorts|embed)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
        }
    }
    return id && VIDEO_ID_RE.test(id) ? id : null;
}
