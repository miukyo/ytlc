import type {
  Author,
  ChatItem,
  EmojiPart,
  ImagePart,
  MembershipDetails,
  MessagePart,
  Superchat,
} from "../types/index.js";
import type { FetchOptions } from "../types/options.js";
import { parseCurrency } from "./currency-parser.js";

export interface ParsedLiveChatResponse {
  actions: unknown[];
  continuation?: string;
}

const toText = (node: unknown): string | undefined => {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  const candidate = node as { simpleText?: string; runs?: Array<{ text?: string }> };
  if (candidate.simpleText) {
    return candidate.simpleText;
  }

  if (!Array.isArray(candidate.runs)) {
    return undefined;
  }

  const text = candidate.runs
    .map((entry) => entry.text ?? "")
    .join("")
    .trim();

  return text.length > 0 ? text : undefined;
};

const toImagePart = (thumbnailNode: unknown, alt?: string): ImagePart | undefined => {
  if (!thumbnailNode || typeof thumbnailNode !== "object") {
    return undefined;
  }

  const thumbnails = (thumbnailNode as { thumbnails?: Array<{ url?: string }> }).thumbnails;
  const url = thumbnails?.at(-1)?.url;
  if (!url) {
    return undefined;
  }

  return {
    type: "image",
    url,
    alt,
  };
};

const toMessageParts = (runs: unknown): MessagePart[] => {
  if (!Array.isArray(runs)) {
    return [];
  }

  const parts: MessagePart[] = [];
  for (const run of runs) {
    if (!run || typeof run !== "object") {
      continue;
    }

    const asRun = run as {
      text?: string;
      emoji?: {
        emojiId?: string;
        isCustomEmoji?: boolean;
        image?: { thumbnails?: Array<{ url?: string }> };
        shortcuts?: string[];
        searchTerms?: string[];
      };
    };

    if (typeof asRun.text === "string") {
      parts.push({ type: "text", text: asRun.text });
      continue;
    }

    if (asRun.emoji) {
      const emoji = asRun.emoji;
      const url = emoji.image?.thumbnails?.at(-1)?.url;
      const alt = emoji.shortcuts?.[0] ?? emoji.searchTerms?.[0];
      const emojiPart: EmojiPart = {
        type: "emoji",
        url: url ?? "",
        alt,
        emojiText: emoji.isCustomEmoji ? alt ?? `[:${emoji.emojiId ?? "unknown"}:]` : emoji.emojiId ?? alt ?? "",
        isCustomEmoji: Boolean(emoji.isCustomEmoji),
      };
      parts.push(emojiPart);
    }
  }

  return parts;
};

const parseBadges = (
  renderer: Record<string, unknown>,
): {
  isMembership: boolean;
  isOwner: boolean;
  isVerified: boolean;
  isModerator: boolean;
  badgeLabel?: string;
  badgeThumbnail?: ImagePart;
} => {
  const badges = renderer.authorBadges;
  if (!Array.isArray(badges)) {
    return {
      isMembership: false,
      isOwner: false,
      isVerified: false,
      isModerator: false,
    };
  }

  let isMembership = false;
  let isOwner = false;
  let isVerified = false;
  let isModerator = false;
  let badgeLabel: string | undefined;
  let badgeThumbnail: ImagePart | undefined;

  for (const item of badges) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const badgeRenderer = (item as { liveChatAuthorBadgeRenderer?: Record<string, unknown> }).liveChatAuthorBadgeRenderer;
    if (!badgeRenderer) {
      continue;
    }

    const customThumbnail = badgeRenderer.customThumbnail;
    if (customThumbnail) {
      isMembership = true;
      badgeLabel = (badgeRenderer.tooltip as string | undefined) ?? badgeLabel ?? "Member";
      badgeThumbnail = toImagePart(customThumbnail, badgeLabel) ?? badgeThumbnail;
      continue;
    }

    const iconType = (badgeRenderer.icon as { iconType?: string } | undefined)?.iconType;
    if (iconType === "OWNER") {
      isOwner = true;
    }
    if (iconType === "VERIFIED") {
      isVerified = true;
    }
    if (iconType === "MODERATOR") {
      isModerator = true;
    }
  }

  return {
    isMembership,
    isOwner,
    isVerified,
    isModerator,
    badgeLabel,
    badgeThumbnail,
  };
};

const parseMembershipDetails = (
  rendererType: string,
  renderer: Record<string, unknown>,
  authorName: string,
): MembershipDetails | undefined => {
  const headerPrimaryText = toText(renderer.headerPrimaryText);
  const headerSubtext = toText(renderer.headerSubtext);

  if (rendererType === "liveChatMembershipItemRenderer") {
    const milestoneMonthsText = headerPrimaryText?.match(/(\d+)\s+months?/i)?.[1];
    return {
      eventType: milestoneMonthsText ? "Milestone" : "New",
      levelName: "Member",
      membershipBadgeLabel: headerSubtext,
      headerPrimaryText,
      headerSubtext,
      milestoneMonths: milestoneMonthsText ? Number.parseInt(milestoneMonthsText, 10) : undefined,
    };
  }

  if (rendererType === "liveChatSponsorshipsGiftPurchaseAnnouncementRenderer") {
    const giftCountText = headerPrimaryText?.match(/gifted\s+(\d+)/i)?.[1];
    return {
      eventType: "GiftPurchase",
      levelName: "Member",
      headerPrimaryText,
      headerSubtext,
      gifterUsername: authorName,
      giftCount: giftCountText ? Number.parseInt(giftCountText, 10) : 1,
    };
  }

  if (rendererType === "liveChatSponsorshipsGiftRedemptionAnnouncementRenderer") {
    return {
      eventType: "GiftRedemption",
      levelName: "Member",
      headerPrimaryText,
      headerSubtext,
      recipientUsername: authorName,
    };
  }

  return undefined;
};

const parseSuperchat = (rendererType: string, renderer: Record<string, unknown>): Superchat | undefined => {
  if (rendererType !== "liveChatPaidMessageRenderer" && rendererType !== "liveChatPaidStickerRenderer") {
    return undefined;
  }

  const amountString = toText(renderer.purchaseAmountText) ?? "";
  const { amountValue, currency } = parseCurrency(amountString);

  const sticker =
    rendererType === "liveChatPaidStickerRenderer"
      ? toImagePart((renderer.sticker as { thumbnails?: unknown[] } | undefined) ?? undefined)
      : undefined;

  return {
    amountString,
    amountValue,
    currency,
    bodyBackgroundColor: String(renderer.bodyBackgroundColor ?? renderer.backgroundColor ?? "000000"),
    headerBackgroundColor: renderer.headerBackgroundColor ? String(renderer.headerBackgroundColor) : undefined,
    headerTextColor: renderer.headerTextColor ? String(renderer.headerTextColor) : undefined,
    bodyTextColor: renderer.bodyTextColor ? String(renderer.bodyTextColor) : undefined,
    authorNameTextColor: renderer.authorNameTextColor ? String(renderer.authorNameTextColor) : undefined,
    sticker,
  };
};

const findRenderer = (
  action: Record<string, unknown>,
): { rendererType: string; renderer: Record<string, unknown>; isTicker: boolean } | undefined => {
  const addItem = (action.addChatItemAction as { item?: Record<string, unknown> } | undefined)?.item;
  const directItem = addItem ?? {};

  const rendererTypes = [
    "liveChatTextMessageRenderer",
    "liveChatPaidMessageRenderer",
    "liveChatPaidStickerRenderer",
    "liveChatMembershipItemRenderer",
    "liveChatSponsorshipsGiftPurchaseAnnouncementRenderer",
    "liveChatSponsorshipsGiftRedemptionAnnouncementRenderer",
  ];

  for (const type of rendererTypes) {
    const renderer = directItem[type];
    if (renderer && typeof renderer === "object") {
      return { rendererType: type, renderer: renderer as Record<string, unknown>, isTicker: false };
    }
  }

  const tickerItem =
    (action.addLiveChatTickerItemAction as { item?: Record<string, unknown> } | undefined)?.item ?? {};

  const tickerCandidates: Array<{ path: string[]; type: string }> = [
    {
      type: "liveChatPaidMessageRenderer",
      path: [
        "liveChatTickerPaidMessageItemRenderer",
        "showItemEndpoint",
        "showLiveChatItemEndpoint",
        "renderer",
        "liveChatPaidMessageRenderer",
      ],
    },
    {
      type: "liveChatMembershipItemRenderer",
      path: [
        "liveChatTickerSponsorItemRenderer",
        "showItemEndpoint",
        "showLiveChatItemEndpoint",
        "renderer",
        "liveChatMembershipItemRenderer",
      ],
    },
    {
      type: "liveChatSponsorshipsGiftPurchaseAnnouncementRenderer",
      path: [
        "liveChatTickerSponsorItemRenderer",
        "showItemEndpoint",
        "showLiveChatItemEndpoint",
        "renderer",
        "liveChatSponsorshipsGiftPurchaseAnnouncementRenderer",
      ],
    },
    {
      type: "liveChatPaidStickerRenderer",
      path: [
        "liveChatTickerPaidStickerItemRenderer",
        "showItemEndpoint",
        "showLiveChatItemEndpoint",
        "renderer",
        "liveChatPaidStickerRenderer",
      ],
    },
  ];

  for (const candidate of tickerCandidates) {
    let current: unknown = tickerItem;
    for (const segment of candidate.path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    if (current && typeof current === "object") {
      return {
        rendererType: candidate.type,
        renderer: current as Record<string, unknown>,
        isTicker: true,
      };
    }
  }

  return undefined;
};

const resolveContinuation = (response: Record<string, unknown>): string | undefined => {
  const continuation = (response.continuationContents as { liveChatContinuation?: Record<string, unknown> } | undefined)
    ?.liveChatContinuation;

  const continuations = continuation?.continuations;
  if (!Array.isArray(continuations) || continuations.length === 0) {
    return undefined;
  }

  const c = continuations[0] as Record<string, unknown>;
  const candidates = [
    (c.timedContinuationData as { continuation?: string } | undefined)?.continuation,
    (c.invalidationContinuationData as { continuation?: string } | undefined)?.continuation,
    (c.liveChatReplayContinuationData as { continuation?: string } | undefined)?.continuation,
    (c.playerSeekContinuationData as { continuation?: string } | undefined)?.continuation,
  ];

  return candidates.find((value) => typeof value === "string");
};

export const parseLivePage = (rawHtml: string): FetchOptions => {
  const replayRegex = /"isReplay"\s*:\s*true/;
  if (replayRegex.test(rawHtml)) {
    throw new Error("Target live stream is a replay and cannot be monitored as active chat.");
  }

  const liveId =
    rawHtml.match(/"videoId"\s*:\s*"([^"]+)"/)?.[1] ??
    rawHtml.match(/canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/)?.[1];
  const apiKey = rawHtml.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)?.[1];
  const clientVersion = rawHtml.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION"\s*:\s*"([^"]+)"/)?.[1];
  const continuation = rawHtml.match(/"continuation"\s*:\s*"([^"]+)"/)?.[1];

  if (!liveId) {
    throw new Error("Live stream id was not found in page payload.");
  }
  if (!apiKey) {
    throw new Error("INNERTUBE_API_KEY was not found in page payload.");
  }
  if (!clientVersion) {
    throw new Error("INNERTUBE_CONTEXT_CLIENT_VERSION was not found in page payload.");
  }
  if (!continuation) {
    throw new Error("Initial continuation token was not found in page payload.");
  }

  return {
    liveId,
    apiKey,
    clientVersion,
    continuation,
  };
};

export const parseLiveChatResponse = (response: unknown): ParsedLiveChatResponse => {
  if (!response || typeof response !== "object") {
    return { actions: [] };
  }

  const root = response as Record<string, unknown>;
  const continuation = (root.continuationContents as { liveChatContinuation?: Record<string, unknown> } | undefined)
    ?.liveChatContinuation;

  const actions = Array.isArray(continuation?.actions) ? continuation.actions : [];

  return {
    actions,
    continuation: resolveContinuation(root),
  };
};

export const parseActionToChatItem = (actionValue: unknown): ChatItem | undefined => {
  if (!actionValue || typeof actionValue !== "object") {
    return undefined;
  }

  const action = actionValue as Record<string, unknown>;
  const resolved = findRenderer(action);
  if (!resolved) {
    return undefined;
  }

  const { rendererType, renderer, isTicker } = resolved;
  const authorName = toText(renderer.authorName) ?? "Unknown Author";
  const badgeState = parseBadges(renderer);

  const author: Author = {
    name: authorName,
    channelId: String(renderer.authorExternalChannelId ?? ""),
    thumbnail: toImagePart(renderer.authorPhoto, authorName),
    badge: badgeState.badgeLabel
      ? {
          label: badgeState.badgeLabel,
          thumbnail: badgeState.badgeThumbnail,
        }
      : undefined,
  };

  const messageRuns =
    (renderer.message as { runs?: unknown[] } | undefined)?.runs ??
    (renderer.headerSubtext as { runs?: unknown[] } | undefined)?.runs;

  const rankTitle = ((renderer.beforeContentButtons as Array<{ buttonViewModel?: { title?: string } }> | undefined)?.[0]
    ?.buttonViewModel?.title ?? "") as string;
  const viewerLeaderboardRank =
    rankTitle.startsWith("#") && Number.isFinite(Number.parseInt(rankTitle.slice(1), 10))
      ? Number.parseInt(rankTitle.slice(1), 10)
      : undefined;

  const membershipDetails = parseMembershipDetails(rendererType, renderer, authorName);

  const timestampUsec = Number(renderer.timestampUsec ?? Date.now() * 1000);

  return {
    id: String(renderer.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    author,
    message: toMessageParts(messageRuns),
    superchat: parseSuperchat(rendererType, renderer),
    membershipDetails,
    isMembership: badgeState.isMembership || Boolean(membershipDetails),
    isVerified: badgeState.isVerified,
    isOwner: badgeState.isOwner,
    isModerator: badgeState.isModerator,
    timestamp: new Date(Math.floor(timestampUsec / 1000)),
    viewerLeaderboardRank,
    isTicker,
  };
};
