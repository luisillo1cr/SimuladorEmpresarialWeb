import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Settings, X } from 'lucide-react';
import { db } from '../../services/firebase/config';
import { useAuth } from '../../hooks/useAuth';

type NotificationCategory = 'pending' | 'approved' | 'rejected' | 'not_required' | 'info';
type NotificationFilter = 'all' | 'pending' | 'resolved';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  companyName: string;
  timestamp: Date | null;
  category: NotificationCategory;
  route: string;
};

type ComplianceDoc = {
  companyId?: string;
  companyName?: string;
  type?: string;
  mode?: string;
  status?: string;
  reviewerComment?: string;
  notes?: string;
  submittedAt?:
    | { seconds?: number; nanoseconds?: number; toDate?: () => Date }
    | Date
    | string
    | number
    | null;
  reviewedAt?:
    | { seconds?: number; nanoseconds?: number; toDate?: () => Date }
    | Date
    | string
    | number
    | null;
  reviewedBy?: string | null;
  submittedBy?: string | null;
  teamId?: string | null;
};

const MAX_ITEMS = 20;

function getCurrentTimestamp() {
  return new Date().getTime();
}

function toDate(value: ComplianceDoc['submittedAt']): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatRelative(date: Date | null) {
  if (!date) return 'Sin fecha';

  const now = Date.now();
  const diffMs = now - date.getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `Hace ${mins} min`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour));
    return `Hace ${hours} h`;
  }

  if (diffMs < week) {
    const days = Math.max(1, Math.floor(diffMs / day));
    return `Hace ${days} d`;
  }

  try {
    return new Intl.DateTimeFormat('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function getRequestTypeLabel(type?: string) {
  return type === 'municipal_patent' ? 'Patente municipal' : 'Inscripción tributaria';
}

function getRequestModeLabel(mode?: string) {
  switch (mode) {
    case 'update':
      return 'actualización';
    case 'renewal':
      return 'renovación';
    case 'initial':
    default:
      return 'solicitud inicial';
  }
}

function getCategory(status?: string): NotificationCategory {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'not_required':
      return 'not_required';
    case 'pending':
    case 'submitted':
      return 'pending';
    default:
      return 'info';
  }
}

function isPendingComplianceStatus(status?: string) {
  return status === 'pending' || status === 'submitted';
}

function getStatusText(category: NotificationCategory) {
  switch (category) {
    case 'approved':
      return 'Aprobada';
    case 'rejected':
      return 'Rechazada';
    case 'not_required':
      return 'No requerida';
    case 'pending':
      return 'Pendiente';
    default:
      return 'Aviso';
  }
}

function getDotClass(category: NotificationCategory) {
  switch (category) {
    case 'approved':
      return 'bg-emerald-500';
    case 'rejected':
      return 'bg-rose-500';
    case 'not_required':
      return 'bg-sky-500';
    case 'pending':
      return 'bg-amber-500';
    default:
      return 'bg-slate-400';
  }
}

function buildRoute(id: string, role?: string) {
  if (role === 'student') {
    return `/my-company?requestId=${encodeURIComponent(id)}`;
  }

  return `/admin/compliance-requests?requestId=${encodeURIComponent(id)}`;
}

function buildNotification(id: string, data: ComplianceDoc, role?: string): NotificationItem {
  const typeLabel = getRequestTypeLabel(data.type);
  const modeLabel = getRequestModeLabel(data.mode);
  const category = getCategory(data.status);
  const reviewedAt = toDate(data.reviewedAt);
  const submittedAt = toDate(data.submittedAt);
  const timestamp = reviewedAt ?? submittedAt;

  const companyName = String(data.companyName ?? 'Empresa sin nombre').trim() || 'Empresa sin nombre';
  const reviewerComment = String(data.reviewerComment ?? '').trim();
  const notes = String(data.notes ?? '').trim();

  let title = '';
  let body = '';

  if (role === 'student') {
    if (category === 'pending') {
      title = `${typeLabel} en revisión`;
      body = `Tu equipo envió un trámite de ${modeLabel} y ahora está pendiente de respuesta docente.`;
    } else if (category === 'approved') {
      title = `${typeLabel} aprobada`;
      body = `El docente aprobó el trámite de ${modeLabel} de tu empresa.`;
    } else if (category === 'rejected') {
      title = `${typeLabel} rechazada`;
      body = `El docente rechazó el trámite de ${modeLabel} de tu empresa.`;
    } else if (category === 'not_required') {
      title = `${typeLabel} no requerida`;
      body = `El docente marcó este trámite como no requerido para tu empresa.`;
    } else {
      title = `${typeLabel} actualizada`;
      body = `Hubo un cambio reciente en este trámite de tu empresa.`;
    }
  } else {
    if (category === 'pending') {
      title = `${typeLabel} pendiente`;
      body = `La empresa ${companyName} tiene un trámite de ${modeLabel} esperando revisión docente.`;
    } else if (category === 'approved') {
      title = `${typeLabel} resuelta`;
      body = `Se aprobó el trámite de ${modeLabel} para ${companyName}.`;
    } else if (category === 'rejected') {
      title = `${typeLabel} observada`;
      body = `Se rechazó el trámite de ${modeLabel} para ${companyName}.`;
    } else if (category === 'not_required') {
      title = `${typeLabel} cerrada`;
      body = `El trámite quedó marcado como no requerido para ${companyName}.`;
    } else {
      title = `${typeLabel} actualizada`;
      body = `Hubo un cambio reciente en el flujo regulatorio de ${companyName}.`;
    }
  }

  const extra = reviewerComment || (role === 'student' ? '' : notes);
  const finalBody = extra ? `${body} ${extra}` : body;

  return {
    id,
    title,
    body: finalBody,
    companyName,
    timestamp,
    category,
    route: buildRoute(id, role),
  };
}

function sortItems(items: NotificationItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.timestamp?.getTime() ?? 0;
    const bTime = b.timestamp?.getTime() ?? 0;
    return bTime - aTime;
  });
}

export function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);
  const [filter, setFilter] = useState<NotificationFilter>(() => {
    return profile?.role === 'student' ? 'all' : 'pending';
  });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(() => {
    if (!profile?.uid) return null;
    return `empresarios_notifications_seen_${profile.uid}_${profile.role ?? 'unknown'}`;
  }, [profile?.uid]);

  useEffect(() => {
    setFilter(profile?.role === 'student' ? 'all' : 'pending');
  }, [profile?.role]);

  useEffect(() => {
    if (!storageKey) {
      setLastSeenAt(0);
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    const parsed = saved ? Number(saved) : 0;
    setLastSeenAt(Number.isFinite(parsed) ? parsed : 0);
  }, [storageKey]);

  useEffect(() => {
    if (!profile) {
      setItems([]);
      return;
    }

    const baseRef = collection(db, 'companyComplianceRequests');
    let requestsQuery: Query<DocumentData>;

    if (profile.role === 'student' && profile.teamId) {
      requestsQuery = query(baseRef, where('teamId', '==', profile.teamId));
    } else {
      requestsQuery = baseRef;
    }

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const mapped = snapshot.docs
          .map((doc) => ({ id: doc.id, data: doc.data() as ComplianceDoc }))
          .filter(({ data }) => {
            if (profile.role === 'student') {
              return data.teamId === profile.teamId;
            }

            if (isPendingComplianceStatus(data.status as ComplianceDoc['status'])) {
              return true;
            }

            return data.reviewedBy ? data.reviewedBy === profile.uid : true;
          })
          .map(({ id, data }) => buildNotification(id, data, profile.role));

        setItems(sortItems(mapped).slice(0, MAX_ITEMS));
      },
      () => {
        setItems([]);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFiltersOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsFiltersOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => (item.timestamp?.getTime() ?? 0) > lastSeenAt).length;
  }, [items, lastSeenAt]);

  const filteredItems = useMemo(() => {
    if (filter === 'pending') {
      return items.filter((item) => item.category === 'pending');
    }

    if (filter === 'resolved') {
      return items.filter((item) =>
        ['approved', 'rejected', 'not_required'].includes(item.category)
      );
    }

    return items;
  }, [filter, items]);

  const markAllAsRead = () => {
    const nextSeenAt = getCurrentTimestamp();
    setLastSeenAt(nextSeenAt);

    if (storageKey) {
      window.localStorage.setItem(storageKey, String(nextSeenAt));
    }
  };

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      markAllAsRead();
    } else {
      setIsFiltersOpen(false);
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAllAsRead();
    setIsOpen(false);
    setIsFiltersOpen(false);
    navigate(item.route);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Abrir notificaciones"
        title="Notificaciones"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-white/70 text-slate-700 shadow-sm backdrop-blur-xl transition hover:scale-[1.02] hover:bg-white dark:bg-[#2a2a2a]/75 dark:text-slate-200 dark:hover:bg-[#313131]"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[0.65rem] font-bold leading-none text-white shadow-sm dark:border-[#232323]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-[24rem] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#1f1f1f]">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-white/10">
            <div>
              <h3 className="text-[1.15rem] font-bold text-slate-800 dark:text-slate-100">
                Notificaciones
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {profile?.role === 'student'
                  ? 'Cambios importantes de tu equipo y empresa.'
                  : 'Solicitudes y cambios relevantes para revisión docente.'}
              </p>
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-[#2d2d2d] dark:text-slate-300 dark:hover:bg-[#363636]"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsFiltersOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-[#2d2d2d] dark:text-slate-300 dark:hover:bg-[#363636]"
                title="Filtros"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsFiltersOpen(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-[#2d2d2d] dark:text-slate-300 dark:hover:bg-[#363636]"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              {isFiltersOpen ? (
                <div className="absolute right-0 top-12 z-10 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#252525]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilter('all');
                      setIsFiltersOpen(false);
                    }}
                    className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      filter === 'all'
                        ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-[#333] dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#2e2e2e]'
                    }`}
                  >
                    Todas
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilter('pending');
                      setIsFiltersOpen(false);
                    }}
                    className={`mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      filter === 'pending'
                        ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-[#333] dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#2e2e2e]'
                    }`}
                  >
                    Solo pendientes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFilter('resolved');
                      setIsFiltersOpen(false);
                    }}
                    className={`mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      filter === 'resolved'
                        ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-[#333] dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#2e2e2e]'
                    }`}
                  >
                    Solo resueltas
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-[#2d2d2d] dark:text-slate-300">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  No hay notificaciones
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Cuando pase algo importante, lo verás aquí.
                </p>
              </div>
            ) : (
              <div>
                {filteredItems.map((item, index) => {
                  const isUnread = (item.timestamp?.getTime() ?? 0) > lastSeenAt;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={[
                        'relative block w-full px-6 py-5 text-left transition',
                        isUnread
                          ? 'bg-slate-50/90 hover:bg-slate-100 dark:bg-[#262626] dark:hover:bg-[#2d2d2d]'
                          : 'bg-white hover:bg-slate-50 dark:bg-[#1f1f1f] dark:hover:bg-[#262626]',
                      ].join(' ')}
                    >
                      {index > 0 ? (
                        <div className="absolute left-6 right-6 top-0 h-px bg-slate-200 dark:bg-white/10" />
                      ) : null}

                      <div className="flex items-start gap-4">
                        <div className="relative mt-1 shrink-0">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 dark:bg-[#313131] dark:text-slate-100">
                            {item.companyName.slice(0, 1).toUpperCase()}
                          </div>
                          <span
                            className={[
                              'absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-[#1f1f1f]',
                              getDotClass(item.category),
                            ].join(' ')}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[0.96rem] leading-6 text-slate-700 dark:text-slate-200">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {item.companyName}
                                </span>{' '}
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                  {item.title}
                                </span>
                              </p>

                              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {item.body}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                <span>{getStatusText(item.category)}</span>
                                <span>•</span>
                                <span>{formatRelative(item.timestamp)}</span>
                              </div>
                            </div>

                            {isUnread ? (
                              <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}