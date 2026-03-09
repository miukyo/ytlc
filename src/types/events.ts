import type { ChatItem } from "./models.js";

/** Payload emitted after initial live page bootstrap succeeds. */
export interface InitialPageLoadedEventArgs {
  liveId: string;
}

/** Payload emitted when monitoring stops. */
export interface ChatStoppedEventArgs {
  reason?: string;
}

/** Payload emitted for parsed chat items. */
export interface ChatReceivedEventArgs {
  chatItem: ChatItem;
}

/** Payload emitted when a livestream becomes active. */
export interface LivestreamStartedEventArgs {
  liveId: string;
}

/** Payload emitted when the active livestream ends. */
export interface LivestreamEndedEventArgs {
  liveId: string;
  reason?: string;
}

/** Payload emitted for raw action objects from YouTube responses. */
export interface RawActionReceivedEventArgs {
  rawAction: unknown;
  parsedChatItem?: ChatItem;
}

/** Payload emitted when service operations throw errors. */
export interface ErrorOccurredEventArgs {
  error: Error;
}

/**
 * Mapping between event names and payload shapes used by `YTLiveChat`.
 */
export interface YTLiveChatEvents {
  initialPageLoaded: InitialPageLoadedEventArgs;
  chatStopped: ChatStoppedEventArgs;
  chatReceived: ChatReceivedEventArgs;
  livestreamStarted: LivestreamStartedEventArgs;
  livestreamEnded: LivestreamEndedEventArgs;
  rawActionReceived: RawActionReceivedEventArgs;
  errorOccurred: ErrorOccurredEventArgs;
}
