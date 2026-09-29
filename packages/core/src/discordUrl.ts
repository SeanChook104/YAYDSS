export const DISCORD_HOSTS = ["discord.com", "ptb.discord.com", "canary.discord.com"] as const;
export type DiscordHost = (typeof DISCORD_HOSTS)[number];

export interface DiscordChannel {
    host: DiscordHost;
    /** Server ID, or "@me" for DMs. */
    guildId: string;
    channelId: string;
}

export interface DiscordLocation extends DiscordChannel {
    messageId?: string;
}

const ID = "\\d{17,20}";
const PATH_RE = new RegExp(`^/channels/(@me|${ID})/(${ID})(?:/(${ID}))?/?$`);

/**
 * Parse a Discord channel or message link.
 * Accepts discord.com, ptb./canary. and the old discordapp.com domain.
 */
export function parseDiscordUrl(input: string): DiscordLocation | null {
    let url: URL;
    try {
        url = new URL(input.trim());
    } catch {
        return null;
    }
    if (url.protocol !== "https:") return null;

    const host = url.hostname
        .toLowerCase()
        .replace(/^www\./, "")
        .replace(/discordapp\.com$/, "discord.com");
    if (!(DISCORD_HOSTS as readonly string[]).includes(host)) return null;

    const m = PATH_RE.exec(url.pathname);
    const guildId = m?.[1];
    const channelId = m?.[2];
    const messageId = m?.[3];
    if (!guildId || !channelId) return null;

    return messageId
        ? { host: host as DiscordHost, guildId, channelId, messageId }
        : { host: host as DiscordHost, guildId, channelId };
}

/** In-app path, e.g. for Vencord's NavigationRouter.transitionTo. */
export function buildMessagePath(guildId: string, channelId: string, messageId: string): string {
    return `/channels/${guildId}/${channelId}/${messageId}`;
}

/** Full link that makes Discord load messages around `messageId`. */
export function buildMessageUrl(channel: DiscordChannel, messageId: string): string {
    return `https://${channel.host}${buildMessagePath(channel.guildId, channel.channelId, messageId)}`;
}
