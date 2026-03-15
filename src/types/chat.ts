export type ChatRoomType =
  | 'team_internal'
  | 'team_professor'
  | 'direct_professor';

export type ChatMessageType = 'text' | 'image';

export type ChatRoom = {
  id: string;
  type: ChatRoomType;
  title: string;
  subtitle: string;
  teamId: string | null;
  participantIds: string[];
  createdBy: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastMessageText: string;
  lastMessageAt?: unknown;
  lastMessageSenderId: string | null;
  isDeleted: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  type: ChatMessageType;
  text: string;
  imageUrl: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted: boolean;
  deletedAt?: unknown | null;
  deletedBy?: string | null;
};

export type UserChatState = {
  id: string;
  uid: string;
  chatId: string;
  lastReadAt?: unknown;
  isPinned?: boolean;
};

export type ChatListItem = {
  id: string;
  title: string;
  subtitle: string;
  type: ChatRoomType;
  unreadCount: number;
  lastMessageText: string;
  lastMessageAt?: unknown;
  isOnline?: boolean;
};