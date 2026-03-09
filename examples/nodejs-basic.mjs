import { YTLiveChat } from "yt-lc";

// Usage:
// 1) npm install yt-lc
// 2) set YT_HANDLE (e.g. @YouTubeChannelHandle) or YT_LIVE_ID
// 3) node examples/nodejs-basic.mjs

const handle = "@SeliaAisnith";
const liveId = null;

const chat = new YTLiveChat({
	requestFrequency: 1200,
});

chat.on("initialPageLoaded", ({ liveId: loadedLiveId }) => {
	console.log("Monitoring live chat:", loadedLiveId);
});

chat.on("chatReceived", ({ chatItem }) => {
	console.log("Raw chat item:", chatItem);
	const text = chatItem.message
		.map((part) => (part.type === "text" ? part.text : (part.alt ?? part.url)))
		.join("");

	const line = text.length > 0 ? text : "[non-text event]";
	console.log(
		`[${chatItem.timestamp.toISOString()}] ${chatItem.author.name}: ${line}`,
	);
});

chat.on("errorOccurred", ({ error }) => {
	console.error("YTLC error:", error.message);
});

chat.on("chatStopped", ({ reason }) => {
	console.log("Chat stopped:", reason ?? "no reason provided");
});

await chat.start({
	handle,
	liveId,
});

process.on("SIGINT", () => {
	chat.stop("Stopped via SIGINT");
	process.exit(0);
});
