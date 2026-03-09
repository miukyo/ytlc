# yt-lc Library Guide

`yt-lc` is a TypeScript/JavaScript library for receiving YouTube live chat events.

## YTLiveChat Service API

This library is centered on the `YTLiveChat` service.

### 1. Create service instance

```ts
import { YTLiveChat } from "yt-lc";

const livechat = new YTLiveChat(options);
```

Required constructor options: none.

`options` is optional (`YTLiveChatOptions`). Most users can start with `new YTLiveChat()`.

### 2. Subscribe to events

```ts
livechat.on("chatReceived", ({ chatItem }) => {
  console.log(chatItem.author.name);
});
```

Return type:

- `livechat.on(...)` returns `this` (chainable).

### 3. Start monitoring

```ts
await livechat.start({ handle: "@YouTubeChannelHandle" });
```

Required start options: at least one of:

- `handle`
- `channelId`
- `liveId`

Return type:

- `start(...)` returns `Promise<void>`.

### 4. Stop / stream / dummy helpers

- `stop(reason?)` -> `void`
- `sendDummy(options?)` -> `ChatItem`
- `streamChatItems(...)` -> `AsyncIterable<ChatItem>`
- `streamRawActions(...)` -> `AsyncIterable<RawActionReceivedEventArgs>`

## Type Reference

Import types from the package root:

```ts
import type {
  ChatItem,
  MembershipDetails,
  MessagePart,
  StartOptions,
  SendDummyOptions,
  YTLiveChatOptions,
  YTLiveChatEvents,
} from "yt-lc";
```

Source references:

- Models: `src/types/models.ts`
- Options: `src/types/options.ts`
- Events: `src/types/events.ts`
- Service interface: `src/interfaces/i-yt-live-chat.ts`

Most commonly used types:

- `YTLiveChatOptions`: constructor configuration
- `StartOptions`: required target (`handle` or `channelId` or `liveId`) for `start(...)`
- `ChatItem`: parsed chat payload emitted in `chatReceived`
- `SendDummyOptions`: shape for `sendDummy(...)`

## Install

```bash
npm install yt-lc
```

## Quick Start

```ts
import { YTLiveChat } from "yt-lc";

const livechat = new YTLiveChat({ requestFrequency: 1000 });

livechat.on("initialPageLoaded", ({ liveId }) => {
  console.log("Monitoring", liveId);
});

livechat.on("chatReceived", ({ chatItem }) => {
  const text = chatItem.message
    .map((part) => (part.type === "text" ? part.text : part.alt ?? part.url))
    .join("");

  console.log(`${chatItem.author.name}: ${text}`);
});

livechat.on("errorOccurred", ({ error }) => {
  console.error(error.message);
});

await livechat.start({ handle: "@YouTubeChannelHandle" });
```

## Stream API

```ts
for await (const item of chat.streamChatItems({ liveId: "VIDEO_ID" })) {
  console.log(item.author.name);
}
```

## Local Dummy Events

Use the same pipeline without network calls:

```ts
chat.sendDummy({
  mode: "text",
  text: "local test message",
  authorName: "dev-bot",
});
```

## Reconnect Behavior

- `autoReconnect`: enable retry behavior.
- `reconnectMaxAttempts`: maximum retry attempts before stopping.
- `reconnectDelayMs`: fixed interval between retries.

## Common Start Options

- `handle`: channel handle (`@...`)
- `channelId`: channel id (`UC...`)
- `liveId`: direct live video id
- `overwrite`: restart active session

## Notes

- This is an unofficial parser over YouTube internal payloads. Schema may change anytime.

## Credits

- [YTLiveChat by Agash](https://github.com/Agash/YTLiveChat) - Reference repo (C#)
