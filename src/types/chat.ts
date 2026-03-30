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
  studentId?: string | null;
  studentName?: string | null;
  professorId?: string | null;
  professorName?: string | null;
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

export type ChatDirectoryUserRole = 'admin' | 'professor' | 'student';

export type ChatDirectoryUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: ChatDirectoryUserRole;
  teamId: string | null;
  status: 'active' | 'inactive' | 'invited';
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
