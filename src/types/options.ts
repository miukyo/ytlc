/**
 * Configuration for `YTLiveChat` behavior.
 *
 * @example
 * ```ts
 * const chat = new YTLiveChat({
 *   requestFrequency: 1200,
 *   autoReconnect: true,
 *   reconnectMaxAttempts: 5,
 *   reconnectDelayMs: 2000,
 * });
 * ```
 */
export interface YTLiveChatOptions {
  /** Base URL for YouTube endpoints. */
  youtubeBaseUrl?: string;

  /** Poll interval for fetching new chat actions (ms). */
  requestFrequency?: number;

  /**
   * If true and started with handle/channelId, keep checking for future live sessions.
   */
  enableContinuousLivestreamMonitor?: boolean;

  /** Poll interval used while waiting for channel to become live (ms). */
  liveCheckFrequency?: number;

  /** Enable reconnect attempts when requests fail. */
  autoReconnect?: boolean;

  /** Maximum reconnect attempts before chat stops. */
  reconnectMaxAttempts?: number;

  /** Fixed delay between reconnect attempts (ms). */
  reconnectDelayMs?: number;

  /** Append raw actions to a debug file. */
  debugLogReceivedJsonItems?: boolean;

  /** Path used when `debugLogReceivedJsonItems` is enabled. */
  debugLogFilePath?: string;

  /** Custom fetch implementation for testing or non-standard runtimes. */
  fetchImplementation?: typeof fetch;
}

/**
 * Controls payload shape for `YTLiveChat.sendDummy`.
 *
 * @example
 * ```ts
 * chat.sendDummy({
 *   mode: "superchat",
 *   amount: 9.99,
 *   currency: "USD",
 *   authorName: "dev-bot",
 * });
 * ```
 */
export interface SendDummyOptions {
  /** Select random generation or force a specific dummy event type. */
  mode?: "random" | "text" | "membership" | "superchat" | "sticker";

  /** Optional text override for text-mode dummy messages. */
  text?: string;

  /** Optional amount override for `superchat`/`sticker` dummy events. */
  amount?: number;

  /** Optional 3-letter currency code override (e.g. `USD`, `JPY`). */
  currency?: string;

  /** Optional author name override for generated events. */
  authorName?: string;
}

/**
 * Identifies which livestream should be monitored.
 */
export interface StartOptions {
  /** Channel handle, such as `@SomeCreator`. */
  handle?: string;

  /** YouTube channel id, such as `UC...`. */
  channelId?: string;

  /** Direct live video id. */
  liveId?: string;

  /** Restart an active session if one is already running. */
  overwrite?: boolean;
}

/**
 * Internal fetch state required for `get_live_chat` requests.
 */
export interface FetchOptions {
  liveId: string;
  apiKey: string;
  clientVersion: string;
  continuation: string;
}
