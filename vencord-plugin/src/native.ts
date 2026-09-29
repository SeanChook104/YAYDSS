/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 SeanChook104
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Runs in Discord desktop's Node process. A tiny HTTP server on 127.0.0.1 that
// accepts "show this moment" ticks from the YAYDSS browser extension.
// The Discord UI (index.tsx) collects them by long-polling waitForTick().
//
// Nothing happens when this file loads: Vencord loads natives even for
// disabled plugins, so the server only starts when index.tsx calls startServer().

import { timingSafeEqual } from "crypto";
import type { IpcMainInvokeEvent } from "electron";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";

import { isTick, PROTOCOL_VERSION, type Tick } from "./core";

const MAX_BODY_BYTES = 4096;

/** A tick plus an arrival number, so the UI knows which ones it has seen. */
export interface Received {
    n: number;
    tick: Tick;
}

let server: Server | null = null;
let port = 0;
let token = Buffer.alloc(0);
let latest: Received | null = null;
let counter = 0;
let waiters: Array<(r: Received | null) => void> = [];

function wake(r: Received | null) {
    const w = waiters;
    waiters = [];
    for (const resolve of w) resolve(r);
}

export async function startServer(
    _: IpcMainInvokeEvent,
    newPort: number,
    newToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    stopServer(_);
    if (!Number.isInteger(newPort) || newPort < 1024 || newPort > 65535) return { ok: false, error: `Invalid port ${newPort}` };
    if (newToken.length < 16) return { ok: false, error: "Pairing token is too short" };

    port = newPort;
    token = Buffer.from(newToken);

    return new Promise(resolve => {
        const s = createServer(handle);
        s.once("error", (err: NodeJS.ErrnoException) => {
            resolve({
                ok: false,
                error: err.code === "EADDRINUSE" ? `Port ${port} is already in use. Pick another in the plugin settings.` : err.message
            });
        });
        s.listen(port, "127.0.0.1", () => {
            server = s;
            resolve({ ok: true });
        });
    });
}

export function stopServer(_: IpcMainInvokeEvent) {
    server?.close();
    server = null;
    latest = null;
    wake(null);
}

/** Resolves with the newest tick after `afterN`, or null after `timeoutMs`. */
export function waitForTick(_: IpcMainInvokeEvent, afterN: number, timeoutMs: number): Promise<Received | null> {
    if (latest && latest.n > afterN) return Promise.resolve(latest);
    return new Promise(resolve => {
        const done = (r: Received | null) => {
            clearTimeout(timer);
            resolve(r);
        };
        const timer = setTimeout(() => {
            waiters = waiters.filter(w => w !== done);
            resolve(null);
        }, Math.min(timeoutMs, 60_000));
        waiters.push(done);
    });
}

function reply(res: ServerResponse, status: number, body?: object) {
    // Deliberately no CORS headers: web pages can't read or preflight us.
    res.writeHead(status, body ? { "Content-Type": "application/json" } : {});
    res.end(body ? JSON.stringify(body) : undefined);
}

function authorised(header: string | undefined): boolean {
    const given = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "");
    return given.length === token.length && timingSafeEqual(given, token);
}

function handle(req: IncomingMessage, res: ServerResponse) {
    // Blocks DNS-rebinding tricks (evil.com resolving to 127.0.0.1).
    const host = req.headers.host ?? "";
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return reply(res, 403, { error: "bad host" });

    // Only browser extensions (or tools like curl, which send no Origin).
    const { origin } = req.headers;
    if (origin && !/^(chrome|moz)-extension:\/\//.test(origin)) return reply(res, 403, { error: "bad origin" });

    if (!authorised(req.headers.authorization)) return reply(res, 401, { error: "wrong pairing token" });

    if (req.method === "GET" && req.url === "/yaydss/v1/ping") {
        return reply(res, 200, { ok: true, name: "YAYDSS", v: PROTOCOL_VERSION });
    }

    if (req.method === "POST" && req.url === "/yaydss/v1/tick") {
        let body = "";
        let tooBig = false;
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
            body += chunk;
            if (body.length > MAX_BODY_BYTES) {
                tooBig = true;
                req.destroy();
            }
        });
        req.on("end", () => {
            if (tooBig) return;
            let tick: unknown;
            try {
                tick = JSON.parse(body);
            } catch {
                return reply(res, 400, { error: "not JSON" });
            }
            if (!isTick(tick)) return reply(res, 400, { error: "not a YAYDSS tick (update the extension or plugin?)" });

            latest = { n: ++counter, tick };
            wake(latest);
            reply(res, 204);
        });
        return;
    }

    reply(res, 404, { error: "not found" });
}
