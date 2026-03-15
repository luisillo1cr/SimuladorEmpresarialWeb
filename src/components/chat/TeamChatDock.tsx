import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../utils/toast';
import type { ChatMessage, ChatRoom, UserChatState } from '../../types/chat';
import {
  markChatAsRead,
  sendTextMessage,
  softDeleteMessage,
  subscribeToAvailableChats,
  subscribeToChatMessages,
  subscribeToChatRoom,
  subscribeToUserChatStates,
} from '../../services/chat/chatService';

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

function formatChatTime(value: unknown) {
  const millis = toMillisSafe(value);

  if (!millis) {
    return '';
  }

  const date = new Date(millis);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function buildInitials(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 'C';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getSenderRoleLabel(role: string) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'professor':
      return 'Profesor';
    case 'student':
    default:
      return 'Estudiante';
  }
}

function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);

    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);

    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // No-op on browsers that block autoplayed audio contexts.
  }
}

export function TeamChatDock() {
  const { profile } = useAuth();

  const [isListOpen, setIsListOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatStates, setChatStates] = useState<UserChatState[]>([]);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const roomTimestampsRef = useRef<Record<string, number>>({});
  const hasPrimedRoomTimestampsRef = useRef(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const unsubscribeRooms = subscribeToAvailableChats(
      {
        uid: profile.uid,
        role: profile.role,
        teamId: profile.teamId ?? null,
      },
      (rooms) => {
        setChatRooms(rooms);
      },
      (error) => {
        console.error('Error cargando chats:', error);
        toast.error(
          'No se pudieron cargar los chats',
          'Revisa las reglas o la configuración del módulo de chat.'
        );
      }
    );

    const unsubscribeStates = subscribeToUserChatStates(
      profile.uid,
      (states) => {
        setChatStates(states);
      },
      (error) => {
        console.error('Error cargando estados de chat:', error);
      }
    );

    return () => {
      unsubscribeRooms();
      unsubscribeStates();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || chatRooms.length === 0) {
      return;
    }

    const incomingOtherUserMessage = chatRooms.some((room) => {
      const lastMessageMillis = toMillisSafe(room.lastMessageAt);
      const previousMillis = roomTimestampsRef.current[room.id] ?? 0;

      roomTimestampsRef.current[room.id] = lastMessageMillis;

      return (
        hasPrimedRoomTimestampsRef.current &&
        lastMessageMillis > previousMillis &&
        room.lastMessageSenderId != null &&
        room.lastMessageSenderId !== profile.uid
      );
    });

    if (!hasPrimedRoomTimestampsRef.current) {
      hasPrimedRoomTimestampsRef.current = true;
      return;
    }

    if (incomingOtherUserMessage) {
      playNotificationSound();
    }
  }, [chatRooms, profile]);

  useEffect(() => {
    if (!activeChatId || !profile) {
      setActiveChatRoom(null);
      setMessages([]);
      return;
    }

    const unsubscribeRoom = subscribeToChatRoom(
      activeChatId,
      (room) => {
        setActiveChatRoom(room);
      },
      (error) => {
        console.error('Error cargando sala de chat:', error);
        toast.error(
          'No se pudo abrir el chat',
          'No fue posible cargar los datos del chat seleccionado.'
        );
      }
    );

    const unsubscribeMessages = subscribeToChatMessages(
      activeChatId,
      (nextMessages) => {
        setMessages(nextMessages);
      },
      (error) => {
        console.error('Error cargando mensajes:', error);
        toast.error(
          'No se pudieron cargar los mensajes',
          'No fue posible leer los mensajes del chat.'
        );
      }
    );

    void markChatAsRead({
      uid: profile.uid,
      chatId: activeChatId,
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [activeChatId, profile]);

  useEffect(() => {
    if (!activeChatId || !profile) {
      return;
    }

    void markChatAsRead({
      uid: profile.uid,
      chatId: activeChatId,
    });

    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, activeChatId, profile]);

  const chatListItems = useMemo(() => {
    return chatRooms.map((room) => {
      const state = chatStates.find((item) => item.chatId === room.id);

      const unreadCount =
        toMillisSafe(room.lastMessageAt) > toMillisSafe(state?.lastReadAt)
          ? 1
          : 0;

      return {
        ...room,
        unreadCount,
      };
    });
  }, [chatRooms, chatStates]);

  const totalUnread = useMemo(() => {
    return chatListItems.reduce((total, room) => total + room.unreadCount, 0);
  }, [chatListItems]);

  const activeWindowRightClass = isListOpen ? 'md:right-[396px]' : 'md:right-6';

  const handleOpenChat = async (chatId: string) => {
    setActiveChatId(chatId);

    if (!isListOpen) {
      setIsListOpen(true);
    }

    if (profile) {
      await markChatAsRead({
        uid: profile.uid,
        chatId,
      });
    }
  };

  const handleSendMessage = async () => {
    if (!profile || !activeChatId || !draftMessage.trim()) {
      return;
    }

    try {
      setIsSending(true);

      await sendTextMessage({
        chatId: activeChatId,
        senderId: profile.uid,
        senderName: `${profile.firstName} ${profile.lastName}`.trim(),
        senderRole: profile.role,
        text: draftMessage,
      });

      setDraftMessage('');
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      toast.error(
        'No se pudo enviar el mensaje',
        'Verifica tu conexión y vuelve a intentarlo.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSoftDeleteMessage = async (messageId: string) => {
    if (!profile || !activeChatId) {
      return;
    }

    try {
      await softDeleteMessage({
        chatId: activeChatId,
        messageId,
        deletedBy: profile.uid,
      });
    } catch (error) {
      console.error('Error eliminando mensaje:', error);
      toast.error(
        'No se pudo eliminar el mensaje',
        'No fue posible aplicar el borrado lógico al mensaje.'
      );
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsListOpen((current) => !current)}
        className="fixed bottom-6 right-6 z-[90] flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl transition hover:scale-[1.02]"
        aria-label="Abrir chats"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-[var(--app-fg)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.2 0-2.33-.24-3.36-.67L3 21l1.8-5.4A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>

        {totalUnread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-semibold text-white shadow-lg">
            {totalUnread}
          </span>
        ) : null}
      </button>

      {isListOpen ? (
        <div className="fixed bottom-24 right-6 z-[88] w-[calc(100vw-2rem)] max-w-[360px] overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
          <div className="border-b border-[color:var(--app-border)] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Chats
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--app-fg)]">
                  Conversaciones
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  En línea · {getSenderRoleLabel(profile.role)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsListOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-sm text-slate-500 transition hover:text-[var(--app-fg)]"
                aria-label="Cerrar panel de chats"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto px-3 py-3">
            {chatListItems.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                No hay chats disponibles todavía para este usuario.
              </div>
            ) : (
              <div className="space-y-2">
                {chatListItems.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => void handleOpenChat(room.id)}
                    className={[
                      'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition',
                      activeChatId === room.id
                        ? 'border-emerald-400/50 bg-emerald-500/10'
                        : 'border-[color:var(--app-border)] bg-[var(--app-surface-muted)] hover:bg-[var(--app-bg)]',
                    ].join(' ')}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-sm font-semibold text-[var(--app-fg)]">
                      {buildInitials(room.title)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--app-fg)]">
                            {room.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {room.subtitle}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatChatTime(room.lastMessageAt)}
                          </span>

                          {room.unreadCount > 0 ? (
                            <span className="inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                              {room.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="mt-2 truncate text-xs text-slate-600 dark:text-slate-400">
                        {room.lastMessageText || 'Sin mensajes todavía.'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activeChatRoom ? (
        <div
          className={[
            'fixed bottom-6 right-6 z-[89] w-[calc(100vw-2rem)] max-w-[380px] overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl',
            activeWindowRightClass,
          ].join(' ')}
        >
          <div className="border-b border-[color:var(--app-border)] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--app-fg)]">
                  {activeChatRoom.title}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {activeChatRoom.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveChatId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-sm text-slate-500 transition hover:text-[var(--app-fg)]"
                aria-label="Cerrar conversación"
              >
                ×
              </button>
            </div>
          </div>

          <div
            ref={messagesContainerRef}
            className="max-h-[360px] min-h-[300px] overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                Todavía no hay mensajes en esta conversación.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isOwnMessage = message.senderId === profile.uid;

                  return (
                    <div
                      key={message.id}
                      className={[
                        'flex',
                        isOwnMessage ? 'justify-end' : 'justify-start',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'max-w-[85%] rounded-2xl border px-4 py-3 shadow-sm',
                          isOwnMessage
                            ? 'border-emerald-400/40 bg-emerald-500/10'
                            : 'border-[color:var(--app-border)] bg-[var(--app-surface-muted)]',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[var(--app-fg)]">
                              {message.senderName}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {getSenderRoleLabel(message.senderRole)}
                            </p>
                          </div>

                          <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                            {formatChatTime(message.createdAt)}
                          </span>
                        </div>

                        <p
                          className={[
                            'mt-2 whitespace-pre-wrap break-words text-sm leading-6',
                            message.isDeleted
                              ? 'italic text-slate-500 dark:text-slate-400'
                              : 'text-[var(--app-fg)]',
                          ].join(' ')}
                        >
                          {message.text}
                        </p>

                        {isOwnMessage && !message.isDeleted ? (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleSoftDeleteMessage(message.id)}
                              className="text-[11px] font-medium text-slate-500 transition hover:text-rose-500"
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form
            className="border-t border-[color:var(--app-border)] px-4 py-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await handleSendMessage();
            }}
          >
            <div className="flex items-end gap-3">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Escribe un mensaje..."
                rows={2}
                className="min-h-[52px] flex-1 resize-none rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
              />

              <button
                type="submit"
                disabled={isSending || !draftMessage.trim()}
                className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-emerald-500 bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? '...' : 'Enviar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
