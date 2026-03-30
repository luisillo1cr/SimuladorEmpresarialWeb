import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
  ChatMessage,
  ChatRoom,
  ChatRoomType,
  UserChatState,
} from '../../types/chat';
import {
  getTeamInternalChatId,
  getTeamProfessorChatId,
  getUserChatStateId,
} from './chatIds';

type BootstrapTeamChatsParams = {
  teamId: string;
  teamName: string;
  memberIds: string[];
  createdBy: string;
};

type SendTextMessageParams = {
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
};

type SoftDeleteMessageParams = {
  chatId: string;
  messageId: string;
  deletedBy: string;
};

type MarkChatAsReadParams = {
  uid: string;
  chatId: string;
};

type SubscribeToAvailableChatsParams = {
  uid: string;
  role: 'admin' | 'professor' | 'student';
  teamId?: string | null;
};

function normalizeLastMessagePreview(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
}

function toMillisSafe(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  return 0;
}

function normalizeChatRoomType(value: unknown): ChatRoomType {
  if (
    value === 'team_internal' ||
    value === 'team_professor' ||
    value === 'direct_professor'
  ) {
    return value;
  }

  return 'team_internal';
}

function mapRoomFromSnapshot(snapshot: DocumentSnapshot): ChatRoom | null {
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return {
    id: snapshot.id,
    type: normalizeChatRoomType(data.type),
    title: data.title ?? '',
    subtitle: data.subtitle ?? '',
    teamId: data.teamId ?? null,
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds
      : [],
    createdBy: data.createdBy ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastMessageText: data.lastMessageText ?? '',
    lastMessageAt: data.lastMessageAt,
    lastMessageSenderId: data.lastMessageSenderId ?? null,
    isDeleted: data.isDeleted === true,
  };
}

export async function ensureTeamChatsExist({
  teamId,
  teamName,
  memberIds,
  createdBy,
}: BootstrapTeamChatsParams) {
  const internalChatId = getTeamInternalChatId(teamId);
  const professorChatId = getTeamProfessorChatId(teamId);

  const internalChatRef = doc(db, 'chats', internalChatId);
  const professorChatRef = doc(db, 'chats', professorChatId);

  const [internalSnapshot, professorSnapshot] = await Promise.all([
    getDoc(internalChatRef),
    getDoc(professorChatRef),
  ]);

  if (!internalSnapshot.exists()) {
    await setDoc(internalChatRef, {
      type: 'team_internal' satisfies ChatRoomType,
      title: `Equipo ${teamName}`,
      subtitle: 'En línea · Equipo',
      teamId,
      participantIds: memberIds,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: '',
      lastMessageAt: null,
      lastMessageSenderId: null,
      isDeleted: false,
    });
  }

  if (!professorSnapshot.exists()) {
    await setDoc(professorChatRef, {
      type: 'team_professor' satisfies ChatRoomType,
      title: `Profesor · ${teamName}`,
      subtitle: 'En línea · Profesor',
      teamId,
      participantIds: memberIds,
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessageText: '',
      lastMessageAt: null,
      lastMessageSenderId: null,
      isDeleted: false,
    });
  }
}

export async function sendTextMessage({
  chatId,
  senderId,
  senderName,
  senderRole,
  text,
}: SendTextMessageParams) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return;
  }

  const chatRef = doc(db, 'chats', chatId);
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  await addDoc(messagesRef, {
    senderId,
    senderName,
    senderRole,
    type: 'text',
    text: normalizedText,
    imageUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
  });

  await updateDoc(chatRef, {
    lastMessageText: normalizeLastMessagePreview(normalizedText),
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
  });
}

export async function softDeleteMessage({
  chatId,
  messageId,
  deletedBy,
}: SoftDeleteMessageParams) {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);

  await updateDoc(messageRef, {
    text: 'Este mensaje fue eliminado.',
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
    updatedAt: serverTimestamp(),
  });
}

function isPermissionDeniedError(error: unknown) {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code?: string }).code === 'permission-denied'
  );
}

export async function markChatAsRead({
  uid,
  chatId,
}: MarkChatAsReadParams) {
  const stateId = getUserChatStateId(uid, chatId);
  const stateRef = doc(db, 'userChatStates', stateId);

  try {
    await setDoc(
      stateRef,
      {
        uid,
        chatId,
        lastReadAt: serverTimestamp(),
        isPinned: false,
      },
      { merge: true }
    );
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
  }
}

export function subscribeToChatMessages(
  chatId: string,
  onData: (messages: ChatMessage[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      const nextMessages: ChatMessage[] = snapshot.docs.map((messageDoc) => {
        const data = messageDoc.data();

        return {
          id: messageDoc.id,
          senderId: data.senderId ?? '',
          senderName: data.senderName ?? '',
          senderRole: data.senderRole ?? '',
          type: data.type === 'image' ? 'image' : 'text',
          text: data.text ?? '',
          imageUrl: data.imageUrl ?? null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          isDeleted: data.isDeleted === true,
          deletedAt: data.deletedAt ?? null,
          deletedBy: data.deletedBy ?? null,
        };
      });

      onData(nextMessages);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeToChatRoom(
  chatId: string,
  onData: (chat: ChatRoom | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const chatRef = doc(db, 'chats', chatId);

  return onSnapshot(
    chatRef,
    (snapshot) => {
      onData(mapRoomFromSnapshot(snapshot));
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeToAvailableChats(
  {
    role,
    teamId,
  }: SubscribeToAvailableChatsParams,
  onData: (rooms: ChatRoom[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  if (role === 'student') {
    if (!teamId) {
      onData([]);
      return () => undefined;
    }

    const internalRef = doc(db, 'chats', getTeamInternalChatId(teamId));
    const professorRef = doc(db, 'chats', getTeamProfessorChatId(teamId));

    let internalRoom: ChatRoom | null = null;
    let professorRoom: ChatRoom | null = null;

    const emitRooms = () => {
      const nextRooms = [internalRoom, professorRoom]
        .filter((room): room is ChatRoom => room != null)
        .filter((room) => !room.isDeleted)
        .sort((a, b) => toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt));

      onData(nextRooms);
    };

    const unsubscribeInternal = onSnapshot(
      internalRef,
      (snapshot) => {
        internalRoom = mapRoomFromSnapshot(snapshot);
        emitRooms();
      },
      (error) => {
        onError?.(error);
      }
    );

    const unsubscribeProfessor = onSnapshot(
      professorRef,
      (snapshot) => {
        professorRoom = mapRoomFromSnapshot(snapshot);
        emitRooms();
      },
      (error) => {
        onError?.(error);
      }
    );

    return () => {
      unsubscribeInternal();
      unsubscribeProfessor();
    };
  }

  if (role === 'professor') {
    const roomsQuery = query(
      collection(db, 'chats'),
      where('type', '==', 'team_professor'),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(
      roomsQuery,
      (snapshot) => {
        const nextRooms = snapshot.docs
          .map((roomDoc) => mapRoomFromSnapshot(roomDoc))
          .filter((room): room is ChatRoom => room != null)
          .filter((room) => !room.isDeleted);

        onData(nextRooms);
      },
      (error) => {
        onError?.(error);
      }
    );
  }

  const roomsQuery = query(
    collection(db, 'chats'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    roomsQuery,
    (snapshot) => {
      const nextRooms = snapshot.docs
        .map((roomDoc) => mapRoomFromSnapshot(roomDoc))
        .filter((room): room is ChatRoom => room != null)
        .filter((room) => !room.isDeleted);

      onData(nextRooms);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeToUserChatStates(
  uid: string,
  onData: (states: UserChatState[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const statesQuery = query(
    collection(db, 'userChatStates'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    statesQuery,
    (snapshot) => {
      const nextStates: UserChatState[] = snapshot.docs.map((stateDoc) => {
        const data = stateDoc.data();

        return {
          id: stateDoc.id,
          uid: data.uid ?? '',
          chatId: data.chatId ?? '',
          lastReadAt: data.lastReadAt,
          isPinned: data.isPinned === true,
        };
      });

      onData(nextStates);
    },
    (error) => {
      onError?.(error);
    }
  );
}
