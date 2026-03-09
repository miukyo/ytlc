/** Membership-specific event variants recognized by the parser. */
export type MembershipEventType =
  | "Unknown"
  | "New"
  | "Milestone"
  | "GiftPurchase"
  | "GiftRedemption";

/** Image payload used in message parts, avatars, and stickers. */
export interface ImagePart {
  type: "image";
  url: string;
  alt?: string;
}

/** Emoji payload represented as an image with metadata. */
export interface EmojiPart {
  type: "emoji";
  url: string;
  alt?: string;
  emojiText: string;
  isCustomEmoji: boolean;
}

/** Plain text segment of a message. */
export interface TextPart {
  type: "text";
  text: string;
}

/** Union of all supported message segment types. */
export type MessagePart = TextPart | EmojiPart | ImagePart;

/** Badge metadata shown next to an author name. */
export interface Badge {
  label: string;
  thumbnail?: ImagePart;
}

/** Chat author metadata. */
export interface Author {
  name: string;
  channelId: string;
  thumbnail?: ImagePart;
  badge?: Badge;
}

/** Super Chat / Super Sticker details. */
export interface Superchat {
  amountString: string;
  amountValue: number;
  currency: string;
  bodyBackgroundColor: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
  authorNameTextColor?: string;
  sticker?: ImagePart;
}

/** Membership event details for join/milestone/gift flows. */
export interface MembershipDetails {
  eventType: MembershipEventType;
  levelName: string;
  membershipBadgeLabel?: string;
  headerPrimaryText?: string;
  headerSubtext?: string;
  milestoneMonths?: number;
  gifterUsername?: string;
  giftCount?: number;
  recipientUsername?: string;
}

/** Normalized chat entity emitted by the service. */
export interface ChatItem {
  id: string;
  author: Author;
  message: MessagePart[];
  superchat?: Superchat;
  membershipDetails?: MembershipDetails;
  isMembership: boolean;
  isVerified: boolean;
  isOwner: boolean;
  isModerator: boolean;
  timestamp: Date;
  viewerLeaderboardRank?: number;
  isTicker: boolean;
}
