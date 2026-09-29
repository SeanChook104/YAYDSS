// Print the Discord jump link for a moment in time (for the Phase 0 manual test).
//
//   node scripts/jump-url.mjs "2026-09-01T20:00" <channel link>
//
// The time is read in your computer's local time zone unless it ends in "Z" or "+08:00" etc.
// Same maths as packages/core/src/snowflake.ts, kept inline so it runs without a build.

const DISCORD_EPOCH = 1420070400000n;

const [when, link] = process.argv.slice(2);
if (!when) {
    console.error('Usage: node scripts/jump-url.mjs "2026-09-01T20:00" [https://discord.com/channels/<guild>/<channel>]');
    process.exit(1);
}

const ms = Date.parse(when);
if (!Number.isFinite(ms)) {
    console.error(`Can't read the time "${when}". Try the format 2026-09-01T20:00`);
    process.exit(1);
}

const id = ((BigInt(ms) - DISCORD_EPOCH) << 22n).toString();
console.log(`time:       ${new Date(ms).toString()}`);
console.log(`message ID: ${id}`);

if (link) {
    const base = link.trim().replace(/\/+$/, "").split("/").slice(0, 6).join("/");
    console.log(`jump link:  ${base}/${id}`);
}
