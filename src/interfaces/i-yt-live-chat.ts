import type {
  ChatItem,
  RawActionReceivedEventArgs,
  YTLiveChatEvents,
} from "../types/index.js";
import type { SendDummyOptions, StartOptions } from "../types/options.js";

/**
 * Public contract for a live chat service implementation.
 *
 * Implementations support both event-based consumption (`on`) and async iterators
 * (`streamChatItems`, `streamRawActions`).
 *
 * @example
 * ```ts
 * const chat: IYTLiveChat = new YTLiveChat();
 * chat.on("chatReceived", ({ chatItem }) => console.log(chatItem.author.name));
 * await chat.start({ liveId: "VIDEO_ID" });
 * ```
 */
export interface IYTLiveChat {
  /**
   * Subscribe to a typed chat event.
   * @returns This instance for chaining.
   */
  on<K extends keyof YTLiveChatEvents>(event: K, listener: (payload: YTLiveChatEvents[K]) => void): this;

  /**
   * Unsubscribe from a typed chat event.
   * @returns This instance for chaining.
   */
  off<K extends keyof YTLiveChatEvents>(event: K, listener: (payload: YTLiveChatEvents[K]) => void): this;

  /**
   * Start monitoring live chat for a target handle, channel, or live video.
   *
   * At least one of `handle`, `channelId`, or `liveId` must be provided.
   *
   * @returns Promise that resolves when startup scheduling is completed.
   */
  start(options?: StartOptions): Promise<void>;

  /**
   * Stop monitoring and emit `chatStopped`.
    * @returns Nothing.
   */
  stop(reason?: string): void;

  /**
   * Stop monitoring and remove all listeners.
    * @returns Nothing.
   */
  dispose(): void;

  /**
   * Emit a local fake chat event through the same event pipeline as real messages.
   * Useful for UI development and integration tests.
    * @returns The generated `ChatItem` that was emitted.
   */
  sendDummy(options?: SendDummyOptions): ChatItem;

  /**
   * Stream parsed chat items with `for await...of`.
    * @returns Async iterable of parsed `ChatItem` values.
   */
  streamChatItems(options?: StartOptions, signal?: AbortSignal): AsyncIterable<ChatItem>;

  /**
   * Stream raw InnerTube actions with `for await...of`.
   * @returns Async iterable of raw action payload envelopes.
   */
  streamRawActions(options?: StartOptions, signal?: AbortSignal): AsyncIterable<RawActionReceivedEventArgs>;
}
