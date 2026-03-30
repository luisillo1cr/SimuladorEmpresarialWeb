import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../utils/toast';
import {
  negativeActionButtonClass,
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';

type ComplianceRequestsPageProps = { isDarkMode: boolean; onToggleTheme: () => void; };
type RequestType = 'tax_registration' | 'municipal_patent';
type RequestStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'not_required';
type RequestMode = 'initial' | 'update' | 'renewal';

type ComplianceRequestRecord = {
  id: string;
  companyId: string;
  companyName: string;
  teamName: string;
  type: RequestType;
  mode: RequestMode;
  status: RequestStatus;
  legalRepresentative: string;
  reviewerComment: string;
  submittedAt: unknown;
  reviewedAt: unknown;
  notes: string;
  formData: Record<string, unknown>;
};

function getTypeLabel(type: RequestType) {
  return type === 'municipal_patent' ? 'Patente municipal' : 'Inscripción tributaria';
}

function getModeLabel(mode: RequestMode) {
  switch (mode) {
    case 'update':
      return 'Actualización';
    case 'renewal':
      return 'Renovación';
    case 'initial':
    default:
      return 'Solicitud inicial';
  }
}

function getStatusLabel(status: RequestStatus) {
  switch (status) {
    case 'approved':
      return 'Aprobada';
    case 'rejected':
      return 'Rechazada';
    case 'not_required':
      return 'No requerida';
    case 'pending':
    case 'submitted':
    default:
      return 'Pendiente';
  }
}

function getStatusClass(status: RequestStatus) {
  return status === 'approved'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
    : status === 'rejected'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300'
      : status === 'not_required'
        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
}

function formatDateTime(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleString('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Pendiente';
}

function isPendingStatus(status: RequestStatus) {
  return status === 'pending' || status === 'submitted';
}

function getFieldLabel(key: string) {
  const labels: Record<string, string> = {
    economicActivity: 'Actividad económica',
    fiscalAddress: 'Dirección fiscal',
    contactEmail: 'Correo de contacto',
    contactPhone: 'Teléfono de contacto',
    estimatedMonthlyIncome: 'Ingreso mensual estimado',
    usesElectronicInvoice: 'Facturación electrónica',
    commercialActivity: 'Actividad comercial',
    businessAddress: 'Dirección del local',
    canton: 'Cantón',
    district: 'Distrito',
    commercialSchedule: 'Horario comercial',
    employeeCount: 'Cantidad de empleados',
  };
  return labels[key] ?? key;
}

function renderFieldValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No';
  }
  if (value == null || value === '') {
    return 'No indicado';
  }
  return String(value);
}

function DetailModal({
  request,
  reviewerComment,
  setReviewerComment,
  onClose,
  onDecide,
  isSaving,
}: {
  request: ComplianceRequestRecord;
  reviewerComment: string;
  setReviewerComment: (value: string) => void;
  onClose: () => void;
  onDecide: (decision: Exclude<RequestStatus, 'pending' | 'submitted'>) => void;
  isSaving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/60 px-4 py-4 backdrop-blur-sm sm:px-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSaving) {
        onClose();
      }
    }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-5 py-4 sm:px-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">Detalle de solicitud</h2>
                <span className={['inline-flex rounded-full border px-3 py-1 text-xs font-semibold', getStatusClass(request.status)].join(' ')}>{getStatusLabel(request.status)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{request.companyName} · {getTypeLabel(request.type)} · {getModeLabel(request.mode)}</p>
            </div>
            <button type="button" onClick={onClose} disabled={isSaving} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500 transition hover:text-[var(--app-fg)]">×</button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Representante legal</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{request.legalRepresentative || 'Sin definir'}</p></div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Equipo</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{request.teamName}</p></div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Fecha de solicitud</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatDateTime(request.submittedAt)}</p></div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Fecha de resolución</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{request.status === 'approved' || request.status === 'rejected' || request.status === 'not_required' ? formatDateTime(request.reviewedAt) : 'Pendiente'}</p></div>
            </div>

            <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--app-fg)]">Observaciones del estudiante</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{request.notes || 'No agregó observaciones.'}</p>
            </div>

            <div className="mt-5">
              <h3 className="text-base font-semibold text-[var(--app-fg)]">Datos del formulario</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {Object.keys(request.formData).length === 0 ? (
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-slate-600 dark:text-slate-400 md:col-span-2">No hay datos adicionales en esta solicitud.</div>
                ) : (
                  Object.entries(request.formData).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{getFieldLabel(key)}</p>
                      <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{renderFieldValue(value)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Comentario docente</label>
              <textarea rows={5} value={reviewerComment} onChange={(event) => setReviewerComment(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
            </div>
          </div>

          <div className="border-t border-[color:var(--app-border)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <button type="button" onClick={onClose} disabled={isSaving} className={neutralActionButtonClass}>Cerrar</button>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {request.type === 'municipal_patent' && isPendingStatus(request.status) ? (
                  <button type="button" onClick={() => onDecide('not_required')} disabled={isSaving} className={neutralActionButtonClass}>No requerida</button>
                ) : null}
                {isPendingStatus(request.status) ? (
                  <>
                    <button type="button" onClick={() => onDecide('rejected')} disabled={isSaving} className={negativeActionButtonClass}>{isSaving ? 'Guardando...' : 'Rechazar'}</button>
                    <button type="button" onClick={() => onDecide('approved')} disabled={isSaving} className={positiveActionButtonClass}>{isSaving ? 'Guardando...' : 'Aprobar'}</button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComplianceRequestsPage({ isDarkMode, onToggleTheme }: ComplianceRequestsPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOutUser, profile } = useAuth();
  const [requests, setRequests] = useState<ComplianceRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ComplianceRequestRecord | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | RequestStatus>('all');

  const visibleRequests = useMemo(
    () => {
      const normalizedSearch = searchTerm.trim().toLowerCase();

      return requests.filter((request) => {
        const matchesCompany = selectedCompanyFilter === 'all' || request.companyId === selectedCompanyFilter;
        const matchesStatus = selectedStatusFilter === 'all' || request.status === selectedStatusFilter;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          request.companyName.toLowerCase().includes(normalizedSearch) ||
          request.teamName.toLowerCase().includes(normalizedSearch) ||
          request.legalRepresentative.toLowerCase().includes(normalizedSearch);

        return matchesCompany && matchesStatus && matchesSearch;
      });
    },
    [requests, searchTerm, selectedCompanyFilter, selectedStatusFilter]
  );
  const pendingCount = useMemo(() => visibleRequests.filter((request) => isPendingStatus(request.status)).length, [visibleRequests]);
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach((request) => {
      if (!map.has(request.companyId)) map.set(request.companyId, request.companyName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [requests]);

  const handleLogout = async () => { await signOutUser(); toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.'); navigate('/login', { replace: true }); };
  const handleOpenProfile = () => navigate('/profile');

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const snapshot = await getDocs(query(collection(db, 'companyComplianceRequests'), orderBy('submittedAt', 'desc')));
      const nextRequests = snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          companyId: String(data.companyId ?? ''),
          companyName: String(data.companyName ?? ''),
          teamName: String(data.teamName ?? ''),
          type: data.type === 'municipal_patent' ? 'municipal_patent' : 'tax_registration',
          mode: data.mode === 'update' ? 'update' : data.mode === 'renewal' ? 'renewal' : 'initial',
          status: data.status === 'approved' || data.status === 'rejected' || data.status === 'not_required' || data.status === 'submitted' ? data.status : 'pending',
          legalRepresentative: String(data.legalRepresentative ?? ''),
          reviewerComment: String(data.reviewerComment ?? ''),
          submittedAt: data.submittedAt ?? null,
          reviewedAt: data.reviewedAt ?? null,
          notes: String(data.notes ?? ''),
          formData: typeof data.formData === 'object' && data.formData != null ? (data.formData as Record<string, unknown>) : {},
        } as ComplianceRequestRecord;
      });
      setRequests(nextRequests);
    } catch {
      toast.error('No se pudieron cargar las solicitudes', 'Verifica la colección companyComplianceRequests y vuelve a intentarlo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadRequests(); }, []);

  useEffect(() => {
    if (requests.length === 0) return;

    const requestId = searchParams.get('requestId');
    if (!requestId) return;

    const matchedRequest = requests.find((request) => request.id === requestId);
    if (!matchedRequest) return;

    setSelectedCompanyFilter(matchedRequest.companyId || 'all');
    setSelectedRequest(matchedRequest);
    setReviewerComment(matchedRequest.reviewerComment ?? '');
  }, [requests, searchParams]);

  const handleOpenRequest = (request: ComplianceRequestRecord) => {
    setSelectedCompanyFilter(request.companyId || 'all');
    setSelectedRequest(request);
    setReviewerComment(request.reviewerComment ?? '');
    setSearchParams({ requestId: request.id });
  };

  const handleCloseReview = () => {
    if (!isSaving) {
      setSelectedRequest(null);
      setReviewerComment('');
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('requestId');
        return next;
      });
    }
  };

  const handleSaveReview = async (decision: Exclude<RequestStatus, 'pending' | 'submitted'>) => {
    if (!selectedRequest) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'companyComplianceRequests', selectedRequest.id), {
        status: decision,
        reviewerComment: reviewerComment.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: profile?.uid ?? null,
      });

      const companyRef = doc(db, 'companies', selectedRequest.companyId);
      const companySnapshot = await getDoc(companyRef);
      const companyData = companySnapshot.data() ?? {};
      const currentFormal = companyData.formalRegistration ?? {};

      const nextTaxStatus =
        selectedRequest.type === 'tax_registration'
          ? decision === 'approved' ? 'active' : 'pending'
          : currentFormal.taxRegistrationStatus === 'active' ? 'active' : 'pending';

      const nextPatentStatus =
        selectedRequest.type === 'municipal_patent'
          ? decision === 'approved' ? 'active' : decision === 'not_required' ? 'not_required' : 'pending'
          : currentFormal.municipalPatentStatus === 'active'
            ? 'active'
            : currentFormal.municipalPatentStatus === 'not_required'
              ? 'not_required'
              : 'pending';

      const hasRegistered = nextTaxStatus === 'active' && (nextPatentStatus === 'active' || nextPatentStatus === 'not_required');
      const nextRegistration = hasRegistered ? 'registered' : 'pending';

      await updateDoc(companyRef, {
        'formalRegistration.taxRegistrationStatus': nextTaxStatus,
        'formalRegistration.municipalPatentStatus': nextPatentStatus,
        'formalRegistration.registrationStatus': nextRegistration,
        status: hasRegistered ? 'registered' : 'draft',
        updatedAt: serverTimestamp(),
      });

      toast.success('Solicitud actualizada', 'La revisión de la solicitud fue guardada correctamente.');
      handleCloseReview();
      await loadRequests();
    } catch {
      toast.error('No se pudo guardar la revisión', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <AppShell title="Solicitudes regulatorias" subtitle="Revisa, aprueba o rechaza los trámites regulatorios enviados por los equipos." isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} onLogout={handleLogout} onOpenProfile={handleOpenProfile}>
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Resumen</h2>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Solicitudes visibles</p><p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{visibleRequests.length}</p></div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Pendientes</p><p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{pendingCount}</p></div>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Buscar solicitud</label>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Empresa, equipo o representante"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por empresa</label>
                <select value={selectedCompanyFilter} onChange={(event) => setSelectedCompanyFilter(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none">
                  <option value="all">Todas las empresas</option>
                  {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Filtrar por estado</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(event) => setSelectedStatusFilter(event.target.value as 'all' | RequestStatus)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="submitted">Enviadas</option>
                  <option value="approved">Aprobadas</option>
                  <option value="rejected">Rechazadas</option>
                  <option value="not_required">No requeridas</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5"><h2 className="text-lg font-semibold">Panel de solicitudes regulatorias</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Aquí se revisan las solicitudes iniciales, actualizaciones y renovaciones enviadas por los equipos.</p></header>
            {isLoading ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Cargando solicitudes...</div>
            ) : visibleRequests.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Todavía no hay solicitudes registradas.</div>
            ) : (
              <div className="max-h-[42rem] space-y-4 overflow-y-auto pr-2">
                {visibleRequests.map((request) => (
                  <article key={request.id} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5 transition hover:border-slate-400/40 hover:bg-[var(--app-surface)]">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <button type="button" onClick={() => handleOpenRequest(request)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-[var(--app-fg)]">{request.companyName}</h3><span className={['inline-flex rounded-full border px-3 py-1 text-xs font-medium', getStatusClass(request.status)].join(' ')}>{getStatusLabel(request.status)}</span></div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{getTypeLabel(request.type)} · {getModeLabel(request.mode)} · Equipo {request.teamName}</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Representante legal: {request.legalRepresentative || 'Sin definir'}</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Fecha de solicitud: {formatDateTime(request.submittedAt)}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Fecha de resolución: {request.status === 'approved' || request.status === 'rejected' || request.status === 'not_required' ? formatDateTime(request.reviewedAt) : 'Pendiente'}</p>
                        {request.notes ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Observaciones: {request.notes}</p> : null}
                      </button>
                      <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
                        {isPendingStatus(request.status) ? (
                          <>
                            <button type="button" onClick={() => { handleOpenRequest(request); }} className={positiveActionButtonClass}>Revisar</button>
                            {request.type === 'municipal_patent' ? <button type="button" onClick={() => { handleOpenRequest(request); }} className={neutralActionButtonClass}>No requerida</button> : null}
                            <button type="button" onClick={() => { handleOpenRequest(request); }} className={negativeActionButtonClass}>Rechazar</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => navigate(`/admin/companies/${request.companyId}`)} className={neutralActionButtonClass}>Ver empresa</button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </AppShell>

      {selectedRequest ? <DetailModal request={selectedRequest} reviewerComment={reviewerComment} setReviewerComment={setReviewerComment} onClose={handleCloseReview} onDecide={(decision) => void handleSaveReview(decision)} isSaving={isSaving} /> : null}
    </>
  );
}
