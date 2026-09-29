import { describe, expect, it } from "vitest";
import { buildMessagePath, buildMessageUrl, parseDiscordUrl } from "../src/discordUrl";

const G = "123456789012345678";
const C = "234567890123456789";
const M = "175928847299117063";

describe("parseDiscordUrl", () => {
    it("parses a channel link", () => {
        expect(parseDiscordUrl(`https://discord.com/channels/${G}/${C}`)).toEqual({
            host: "discord.com",
            guildId: G,
            channelId: C
        });
    });

    it("parses a message link", () => {
        expect(parseDiscordUrl(`https://discord.com/channels/${G}/${C}/${M}`)?.messageId).toBe(M);
    });

    it.each([
        ["https://ptb.discord.com", "ptb.discord.com"],
        ["https://canary.discord.com", "canary.discord.com"],
        ["https://discordapp.com", "discord.com"],
        ["https://canary.discordapp.com", "canary.discord.com"],
        ["https://www.discord.com", "discord.com"]
    ])("normalises host %s", (origin, host) => {
        expect(parseDiscordUrl(`${origin}/channels/${G}/${C}`)?.host).toBe(host);
    });

    it("accepts DMs, trailing slash, spaces and query strings", () => {
        expect(parseDiscordUrl(`https://discord.com/channels/@me/${C}`)?.guildId).toBe("@me");
        expect(parseDiscordUrl(`  https://discord.com/channels/${G}/${C}/  `)?.channelId).toBe(C);
        expect(parseDiscordUrl(`https://discord.com/channels/${G}/${C}?foo=1`)?.channelId).toBe(C);
    });

    it.each([
        "not a url",
        `http://discord.com/channels/${G}/${C}`,
        `https://evil.com/channels/${G}/${C}`,
        `https://discord.com.evil.com/channels/${G}/${C}`,
        `https://discord.com/channels/${G}`,
        `https://discord.com/channels/${G}/abc`,
        `https://discord.com/invite/abc`
    ])("rejects %s", url => {
        expect(parseDiscordUrl(url)).toBeNull();
    });
});

describe("build", () => {
    it("builds path and URL", () => {
        expect(buildMessagePath(G, C, M)).toBe(`/channels/${G}/${C}/${M}`);
        expect(buildMessageUrl({ host: "ptb.discord.com", guildId: G, channelId: C }, M)).toBe(
            `https://ptb.discord.com/channels/${G}/${C}/${M}`
        );
    });
});
