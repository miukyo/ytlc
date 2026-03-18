import { appendFile } from "node:fs/promises";

import type { IYTLiveChat } from "../interfaces/i-yt-live-chat.js";
import {
	parseActionToChatItem,
	parseLiveChatResponse,
	parseLivePage,
} from "../helpers/parser.js";
import type {
	Author,
	ChatItem,
	MembershipDetails,
	MessagePart,
	RawActionReceivedEventArgs,
	SendDummyOptions,
	StartOptions,
	YTLiveChatEvents,
	YTLiveChatOptions,
} from "../types/index.js";
import { AsyncQueue } from "../utils/async-queue.js";
import { TypedEventEmitter } from "../utils/typed-event-emitter.js";
import { YTHttpClient } from "./yt-http-client.js";

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const isNotStreamingError = (error: Error): boolean => {
	const message = error.message.toLowerCase();

	return (
		message.includes("live stream id was not found") ||
		message.includes("initial continuation token was not found") ||
		message.includes("target live stream is a replay")
	);
};

const pick = <T>(items: T[]): T =>
	items[Math.floor(Math.random() * items.length)] as T;

const DUMMY_NAMES = [
	"@CoffeeNeko",
	"@OrbitPilot",
	"@AquaByte",
	"@PixelMango",
	"@LunarFork",
	"@ThreadSniper",
	"@NeonDiver",
];

const DUMMY_MESSAGES = [
  "This stream is so good lol",
  "Can you explain that part again pls",
  "Glad everything is still working haha",
  "This update looks really nice tbh",
  "Can we add emojis soon?",
  "Big shoutout to the dev fr",
  "Can I use this at work too btw",
];

const DUMMY_EMOJIS = [":rocket:", ":wave:", ":sparkles:", ":fire:", ":heart:"];

const DUMMY_COLORS = [
	"4278190335",
	"4282664004",
	"4291521144",
	"4294967295",
	"4289449455",
];

const CURRENCY_SYMBOLS: Record<string, string> = {
	USD: "$",
	EUR: "EUR ",
	GBP: "GBP ",
	JPY: "JPY ",
};

const normalizeDummyAmount = (value: number | undefined): number => {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return Number((Math.random() * 99 + 1).toFixed(2));
	}

	return Number(value.toFixed(2));
};

const normalizeDummyCurrency = (value: string | undefined): string => {
	if (!value || value.trim().length === 0) {
		return "USD";
	}

	return value.trim().toUpperCase();
};

const toAmountString = (amount: number, currency: string): string => {
	const symbolOrPrefix = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
	return `${symbolOrPrefix}${amount.toFixed(2)}`;
};

const toDummyAuthor = (nameOverride?: string): Author => {
	const name = nameOverride ?? pick(DUMMY_NAMES);
	return {
		name,
		channelId: `UC_${Math.random().toString(36).slice(2, 18)}`,
		thumbnail: {
			type: "image",
			url: `https://yt3.ggpht.com/MNP0hHFQGsrpYCSw42fprx-RsLPWaVlEsyAj-q6fzHbgccgQ95AFhoCpHSNgJbsqVHSuhBJgLQ=s108-c-k-c0x00ffffff-no-rj`,
			alt: `${name} avatar`,
		},
	};
};

const toDummyMessage = (textOverride?: string): MessagePart[] => {
	if (textOverride) {
		return [{ type: "text", text: textOverride }];
	}

	if (Math.random() > 0.8) {
		return [
			{ type: "text", text: `${pick(DUMMY_MESSAGES)} ` },
			{
				type: "emoji",
				emojiText: pick(DUMMY_EMOJIS),
				url: "https://yt3.ggpht.com/cktIaPxFwnrPwn-alHvnvedHLUJwbHi8HCK3AgbHpphrMAW99qw0bDfxuZagSY5ieE9BBrA=w24-h24-c-k-nd",
				alt: pick(DUMMY_EMOJIS),
				isCustomEmoji: false,
			},

			{ type: "text", text: `${pick(DUMMY_MESSAGES)} ` },
		];
	}

	if (Math.random() > 0.6) {
		return [
			{ type: "text", text: `${pick(DUMMY_MESSAGES)} ` },
			{
				type: "emoji",
				emojiText: pick(DUMMY_EMOJIS),
				url: "https://yt3.ggpht.com/cktIaPxFwnrPwn-alHvnvedHLUJwbHi8HCK3AgbHpphrMAW99qw0bDfxuZagSY5ieE9BBrA=w24-h24-c-k-nd",
				alt: pick(DUMMY_EMOJIS),
				isCustomEmoji: false,
			},
		];
	}

	return [{ type: "text", text: pick(DUMMY_MESSAGES) }];
};

const toDummyMembership = (author: Author): MembershipDetails => {
	const eventType = pick<MembershipDetails["eventType"]>([
		"New",
		"Milestone",
		"GiftPurchase",
		"GiftRedemption",
	]);

	if (eventType === "Milestone") {
		const months = Math.floor(Math.random() * 36) + 2;
		return {
			eventType,
			levelName: "Member",
			membershipBadgeLabel: `Member (${Math.floor(months / 12)} years)`,
			headerPrimaryText: `Member for ${months} months`,
			headerSubtext: "The Fam",
			milestoneMonths: months,
		};
	}

	if (eventType === "GiftPurchase") {
		const gifts = Math.floor(Math.random() * 10) + 1;
		return {
			eventType,
			levelName: "Member",
			headerPrimaryText: `Gifted ${gifts} memberships`,
			gifterUsername: author.name,
			giftCount: gifts,
		};
	}

	if (eventType === "GiftRedemption") {
		return {
			eventType,
			levelName: "Member",
			headerPrimaryText: "Received a gifted membership",
			recipientUsername: author.name,
		};
	}

	return {
		eventType,
		levelName: "Member",
		membershipBadgeLabel: "New member",
		headerSubtext: "Welcome to the channel",
	};
};

const DEFAULT_OPTIONS: Required<
	Pick<
		YTLiveChatOptions,
		| "youtubeBaseUrl"
		| "requestFrequency"
		| "enableContinuousLivestreamMonitor"
		| "liveCheckFrequency"
		| "autoReconnect"
		| "reconnectMaxAttempts"
		| "reconnectDelayMs"
		| "debugLogReceivedJsonItems"
		| "debugLogFilePath"
	>
> = {
	youtubeBaseUrl: "https://www.youtube.com",
	requestFrequency: 1000,
	enableContinuousLivestreamMonitor: false,
	liveCheckFrequency: 10_000,
	autoReconnect: true,
	reconnectMaxAttempts: 5,
	reconnectDelayMs: 2_000,
	debugLogReceivedJsonItems: false,
	debugLogFilePath: "./ytlivechat_debug_items.jsonl",
};

/**
 * Main live chat service for YouTube InnerTube chat polling.
 *
 * Supports typed events, async iterators, local dummy injection, and auto reconnect.
 */
export class YTLiveChat
	extends TypedEventEmitter<YTLiveChatEvents>
	implements IYTLiveChat
{
	private readonly options: Required<YTLiveChatOptions>;
	private readonly httpClient: YTHttpClient;

	private activeRun?: Promise<void>;
	private abortController?: AbortController;
	private activeLiveId?: string;

	/**
	 * Create a `YTLiveChat` service instance.
	 *
	 * No constructor options are required.
	 *
	 * @param options Optional runtime configuration.
	 * @param httpClient Optional custom HTTP client.
	 *
	 * @example
	 * ```ts
	 * const livechat = new YTLiveChat();
	 *
	 * livechat.on("chatReceived", ({ chatItem }) => {
	 *   console.log(chatItem.author.name);
	 * });
	 *
	 * await livechat.start({ handle: "@YouTubeChannelHandle" });
	 * ```
	 */
	constructor(options: YTLiveChatOptions = {}, httpClient?: YTHttpClient) {
		super();
		this.options = {
			...DEFAULT_OPTIONS,
			...options,
			fetchImplementation: options.fetchImplementation ?? fetch,
		};
		this.httpClient = httpClient ?? new YTHttpClient(this.options);
	}

	/**
	 * Start monitoring chat for a specific target.
	 * At least one of `handle`, `channelId`, or `liveId` is required.
	 *
	 * @example
	 * ```ts
	 * const livechat = new YTLiveChat();
	 * await livechat.start({ handle: "@YouTubeChannelHandle" });
	 * ```
	 */
	async start(options: StartOptions = {}): Promise<void> {
		const { overwrite = false } = options;

		if (this.activeRun && !overwrite) {
			return;
		}

		if (this.activeRun && overwrite) {
			this.stop("Restart requested with overwrite=true.");
			await this.activeRun.catch(() => undefined);
		}

		if (!options.handle && !options.channelId && !options.liveId) {
			throw new Error("Either handle, channelId, or liveId must be provided.");
		}

		this.abortController = new AbortController();
		this.activeRun = this.runLoop(options, this.abortController.signal).catch(
			(error: unknown) => {
				const wrapped =
					error instanceof Error ? error : new Error(String(error));
				this.emit("errorOccurred", { error: wrapped });
				this.stop(`Critical error: ${wrapped.message}`);
			},
		);

		await Promise.resolve();
	}

	/**
	 * Stop monitoring and emit `chatStopped`.
	 */
	stop(reason = "Stopped by user."): void {
		this.abortController?.abort();
		this.abortController = undefined;
		this.activeRun = undefined;

		if (this.activeLiveId) {
			this.emit("livestreamEnded", {
				liveId: this.activeLiveId,
				reason,
			});
			this.activeLiveId = undefined;
		}

		this.emit("chatStopped", { reason });
	}

	/**
	 * Dispose service resources and remove all listeners.
	 */
	dispose(): void {
		this.stop("Disposed");
		this.removeAllListeners();
	}

	/**
	 * Inject a local fake event through the same pipeline as real events.
	 *
	 * @example
	 * ```ts
	 * chat.sendDummy({ mode: "text", text: "hello from UI test" });
	 * ```
	 */
	sendDummy(options: SendDummyOptions = {}): ChatItem {
		const chatItem = this.createDummyChatItem(options);
		const rawAction = this.toDummyRawAction(chatItem);

		this.emit("rawActionReceived", { rawAction, parsedChatItem: chatItem });
		this.emit("chatReceived", { chatItem });

		return chatItem;
	}

	/**
	 * Stream parsed chat items as an async iterable.
	 *
	 * @example
	 * ```ts
	 * for await (const item of chat.streamChatItems({ liveId: "VIDEO_ID" })) {
	 *   console.log(item.author.name);
	 * }
	 * ```
	 */
	async *streamChatItems(
		options: StartOptions = {},
		signal?: AbortSignal,
	): AsyncIterable<ChatItem> {
		const queue = new AsyncQueue<ChatItem>();

		const onChat = (payload: YTLiveChatEvents["chatReceived"]): void => {
			queue.push(payload.chatItem);
		};
		const onStop = (): void => {
			queue.end();
		};

		this.on("chatReceived", onChat);
		this.on("chatStopped", onStop);
		this.on("errorOccurred", onStop);

		if (signal) {
			signal.addEventListener("abort", onStop, { once: true });
		}

		try {
			await this.start(options);
			for await (const item of queue) {
				if (signal?.aborted) {
					break;
				}
				yield item;
			}
		} finally {
			this.off("chatReceived", onChat);
			this.off("chatStopped", onStop);
			this.off("errorOccurred", onStop);
			if (signal) {
				signal.removeEventListener("abort", onStop);
			}
		}
	}

	/**
	 * Stream raw action payloads as an async iterable.
	 *
	 * @example
	 * ```ts
	 * for await (const action of chat.streamRawActions({ liveId: "VIDEO_ID" })) {
	 *   console.log(action.rawAction);
	 * }
	 * ```
	 */
	async *streamRawActions(
		options: StartOptions = {},
		signal?: AbortSignal,
	): AsyncIterable<RawActionReceivedEventArgs> {
		const queue = new AsyncQueue<RawActionReceivedEventArgs>();

		const onRaw = (payload: RawActionReceivedEventArgs): void => {
			queue.push(payload);
		};
		const onStop = (): void => {
			queue.end();
		};

		this.on("rawActionReceived", onRaw);
		this.on("chatStopped", onStop);
		this.on("errorOccurred", onStop);

		if (signal) {
			signal.addEventListener("abort", onStop, { once: true });
		}

		try {
			await this.start(options);
			for await (const action of queue) {
				if (signal?.aborted) {
					break;
				}
				yield action;
			}
		} finally {
			this.off("rawActionReceived", onRaw);
			this.off("chatStopped", onStop);
			this.off("errorOccurred", onStop);
			if (signal) {
				signal.removeEventListener("abort", onStop);
			}
		}
	}

	private async runLoop(
		options: StartOptions,
		signal: AbortSignal,
	): Promise<void> {
		const continuous = Boolean(
			this.options.enableContinuousLivestreamMonitor && !options.liveId,
		);
		let reconnectAttempt = 0;

		while (!signal.aborted) {
			let fetchOptions;
			try {
				const rawPage = await this.httpClient.fetchLivePage(options, signal);
				fetchOptions = parseLivePage(rawPage);
				reconnectAttempt = 0;
			} catch (error) {
				const wrapped =
					error instanceof Error ? error : new Error(String(error));

				if (!continuous && isNotStreamingError(wrapped)) {
					const reason = "Target channel/video is not currently streaming.";
					this.emit("chatStopped", { reason });
					return;
				}

				if (!continuous && !this.options.autoReconnect) {
					throw wrapped;
				}

				this.emit("errorOccurred", { error: wrapped });

				reconnectAttempt += 1;
				if (reconnectAttempt > this.options.reconnectMaxAttempts) {
					const reason = `Reconnect attempts exceeded (${this.options.reconnectMaxAttempts}). Last error: ${wrapped.message}`;
					this.emit("chatStopped", { reason });
					return;
				}

				const reconnectDelay = continuous
					? this.options.liveCheckFrequency
					: this.options.reconnectDelayMs;
				await delay(
					continuous ? this.options.liveCheckFrequency : reconnectDelay,
				);
				continue;
			}

			this.activeLiveId = fetchOptions.liveId;
			this.emit("livestreamStarted", { liveId: fetchOptions.liveId });
			this.emit("initialPageLoaded", { liveId: fetchOptions.liveId });

			let stopReason = "Live chat continuation ended.";

			while (!signal.aborted) {
				let response: unknown;
				try {
					response = await this.httpClient.fetchLiveChatData(
						fetchOptions,
						signal,
					);
					reconnectAttempt = 0;
				} catch (error) {
					const wrapped =
						error instanceof Error ? error : new Error(String(error));
					this.emit("errorOccurred", { error: wrapped });

					if (!this.options.autoReconnect && !continuous) {
						throw wrapped;
					}

					reconnectAttempt += 1;
					if (reconnectAttempt > this.options.reconnectMaxAttempts) {
						stopReason = `Reconnect attempts exceeded (${this.options.reconnectMaxAttempts}). Last error: ${wrapped.message}`;
						break;
					}

					const reconnectDelay = this.options.reconnectDelayMs;
					stopReason = `Connection lost. Reconnecting in ${reconnectDelay}ms.`;
					await delay(reconnectDelay);
					break;
				}

				const parsedResponse = parseLiveChatResponse(response);

				if (!parsedResponse.continuation) {
					stopReason = "No continuation token found. Stream likely ended.";
					break;
				}

				fetchOptions.continuation = parsedResponse.continuation;

				for (const action of parsedResponse.actions) {
					const parsedChatItem = parseActionToChatItem(action);
					this.emit("rawActionReceived", { rawAction: action, parsedChatItem });

					if (parsedChatItem) {
						this.emit("chatReceived", { chatItem: parsedChatItem });
					}

					if (this.options.debugLogReceivedJsonItems) {
						await this.logDebugItem(action);
					}
				}

				await delay(this.options.requestFrequency);
			}

			if (signal.aborted) {
				return;
			}

			this.emit("livestreamEnded", {
				liveId: fetchOptions.liveId,
				reason: stopReason,
			});

			if (!continuous) {
				this.activeLiveId = undefined;
				this.emit("chatStopped", { reason: stopReason });
				return;
			}

			await delay(this.options.liveCheckFrequency);
		}
	}

	private async logDebugItem(action: unknown): Promise<void> {
		try {
			const line = `${JSON.stringify(action)}\n`;
			await appendFile(this.options.debugLogFilePath, line, "utf8");
		} catch {
			// Debug logging should never crash chat polling.
		}
	}

	private createDummyChatItem(options: SendDummyOptions): ChatItem {
		const author = toDummyAuthor(options.authorName);
		const eventKind =
			options.mode && options.mode !== "random"
				? options.mode
				: pick(["text", "superchat", "membership", "sticker"] as const);

		const baseItem: ChatItem = {
			id: `dummy_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			author,
			message: toDummyMessage(options.text),
			isMembership: Math.random() > 0.6,
			isVerified: Math.random() > 0.9,
			isOwner: Math.random() > 0.98,
			isModerator: Math.random() > 0.92,
			timestamp: new Date(),
			viewerLeaderboardRank:
				Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : undefined,
			isTicker: Math.random() > 0.85,
		};

		if (eventKind === "membership") {
			baseItem.membershipDetails = toDummyMembership(author);
			baseItem.isMembership = true;
		}

		if (eventKind === "superchat" || eventKind === "sticker") {
			const amount = normalizeDummyAmount(options.amount);
			const currency = normalizeDummyCurrency(options.currency);
			baseItem.superchat = {
				amountString: toAmountString(amount, currency),
				amountValue: amount,
				currency,
				bodyBackgroundColor: pick(DUMMY_COLORS),
				headerBackgroundColor: pick(DUMMY_COLORS),
				headerTextColor: "FFFFFFFF",
				bodyTextColor: "FFFFFFFF",
				authorNameTextColor: "FFFFFFFF",
				sticker:
					eventKind === "sticker"
						? {
								type: "image",
								url: "https://1.bp.blogspot.com/-L5EEP6irqNo/Xb_AxRYPYVI/AAAAAAAACUE/KVwBuP1Nyg8n5YYBf7Kdsbx5b-7E5ELIwCLcBGAsYHQ/s1600/1hippo.gif",
								alt: "Super Sticker",
							}
						: undefined,
			};
		}

		return baseItem;
	}

	private toDummyRawAction(chatItem: ChatItem): unknown {
		return {
			addChatItemAction: {
				item: {
					liveChatTextMessageRenderer: {
						id: chatItem.id,
						authorName: { simpleText: chatItem.author.name },
						authorExternalChannelId: chatItem.author.channelId,
						message: {
							runs: chatItem.message.map((part) => {
								if (part.type === "text") {
									return { text: part.text };
								}

								if (part.type === "emoji") {
									return {
										emoji: {
											emojiId: part.emojiText,
											isCustomEmoji: part.isCustomEmoji,
											image: {
												thumbnails: [{ url: part.url }],
											},
											shortcuts: [part.alt ?? part.emojiText],
										},
									};
								}

								return { text: part.alt ?? "[image]" };
							}),
						},
						timestampUsec: String(chatItem.timestamp.getTime() * 1000),
					},
				},
			},
		};
	}
}
