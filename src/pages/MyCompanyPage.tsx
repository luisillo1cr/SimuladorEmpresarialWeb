import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../utils/toast';
import {
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';

type MyCompanyPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type FormalRegistrationStatus = 'pending' | 'in_review' | 'registered';
type TaxRegistrationStatus = 'pending' | 'active';
type MunicipalPatentStatus = 'pending' | 'active' | 'not_required';
type ComplianceRequestStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'not_required';
type ComplianceRequestMode = 'initial' | 'update' | 'renewal';
type ComplianceRequestType = 'tax_registration' | 'municipal_patent';

type CompanyRecord = {
  id: string;
  teamId: string;
  teamName: string;
  businessName: string;
  tradeName: string;
  legalId: string;
  industry: string;
  status: 'draft' | 'registered';
  formalRegistration: {
    societyType: 'sa' | 'srl';
    legalRepresentative: string;
    registrationStatus: FormalRegistrationStatus;
    taxRegistrationStatus: TaxRegistrationStatus;
    municipalPatentStatus: MunicipalPatentStatus;
    notes: string;
  };
};

type MonthlyOperationRecord = {
  id: string;
  companyId: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  openingCash: number;
  totalIncome: number;
  totalExpenses: number;
  closingCash: number;
  netResult: number;
  status: 'draft' | 'closed';
};

type ComplianceRequestRecord = {
  id: string;
  companyId: string;
  companyName: string;
  teamId: string;
  teamName: string;
  type: ComplianceRequestType;
  mode: ComplianceRequestMode;
  status: ComplianceRequestStatus;
  legalRepresentative: string;
  notes: string;
  submittedAt: unknown;
  reviewedAt: unknown;
  reviewerComment: string;
  formData: Record<string, unknown>;
};

type RequestFormState = {
  notes: string;
  economicActivity: string;
  fiscalAddress: string;
  contactEmail: string;
  contactPhone: string;
  estimatedMonthlyIncome: string;
  usesElectronicInvoice: boolean;
  commercialActivity: string;
  businessAddress: string;
  canton: string;
  district: string;
  commercialSchedule: string;
  employeeCount: string;
  patentContactPhone: string;
};

const initialRequestForm: RequestFormState = {
  notes: '',
  economicActivity: '',
  fiscalAddress: '',
  contactEmail: '',
  contactPhone: '',
  estimatedMonthlyIncome: '',
  usesElectronicInvoice: false,
  commercialActivity: '',
  businessAddress: '',
  canton: '',
  district: '',
  commercialSchedule: '',
  employeeCount: '',
  patentContactPhone: '',
};

function getRegistrationStatusLabel(status: FormalRegistrationStatus) {
  switch (status) {
    case 'registered':
      return 'Inscrita';
    case 'in_review':
      return 'En revisión';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

function getTaxStatusLabel(status: TaxRegistrationStatus) {
  return status === 'active' ? 'Activa' : 'Pendiente';
}

function getPatentStatusLabel(status: MunicipalPatentStatus) {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'not_required':
      return 'No requerida';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

function getRequestTypeLabel(type: ComplianceRequestType) {
  return type === 'municipal_patent' ? 'Patente municipal' : 'Inscripción tributaria';
}

function getRequestStatusLabel(status: ComplianceRequestStatus) {
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

function getRequestStatusClass(status: ComplianceRequestStatus) {
  switch (status) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300';
    case 'not_required':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
    case 'pending':
    case 'submitted':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  }
}

function getRequestModeLabel(mode: ComplianceRequestMode) {
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2,
  }).format(value);
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

function getTimestampSortValue(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds?: number }).seconds === 'number'
  ) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }

  return 0;
}

function sanitizeDigits(value: string, maxLength?: number) {
  const onlyDigits = value.replace(/\D+/g, '');
  const noLeadingZeros = onlyDigits.replace(/^0+/, '');
  const normalized = noLeadingZeros || '';
  return typeof maxLength === 'number' ? normalized.slice(0, maxLength) : normalized;
}

function isPendingStatus(status: ComplianceRequestStatus) {
  return status === 'pending' || status === 'submitted';
}

function getPendingRequestByType(
  requests: ComplianceRequestRecord[],
  type: ComplianceRequestType
) {
  return requests.find((request) => request.type === type && isPendingStatus(request.status)) ?? null;
}

function StudentRequestModal({
  type,
  mode,
  form,
  legalRepresentative,
  onClose,
  onChange,
  onToggleInvoice,
  onSubmit,
  isSaving,
}: {
  type: ComplianceRequestType;
  mode: ComplianceRequestMode;
  form: RequestFormState;
  legalRepresentative: string;
  onClose: () => void;
  onChange: (field: keyof RequestFormState, value: string) => void;
  onToggleInvoice: (checked: boolean) => void;
  onSubmit: () => void;
  isSaving: boolean;
}) {
  const isTax = type === 'tax_registration';

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
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                {isTax ? (mode === 'update' ? 'Actualizar tributación' : 'Solicitar tributación') : mode === 'renewal' ? 'Renovar patente municipal' : 'Solicitar patente municipal'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Completa la información para que el docente pueda revisar el trámite con criterio.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500 transition hover:text-[var(--app-fg)]"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Trámite</p>
                <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{getRequestTypeLabel(type)}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Representante legal</p>
                <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{legalRepresentative || 'Sin definir'}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {isTax ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Actividad económica</span>
                    <input value={form.economicActivity} onChange={(event) => onChange('economicActivity', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Dirección fiscal</span>
                    <input value={form.fiscalAddress} onChange={(event) => onChange('fiscalAddress', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo de contacto</span>
                    <input type="email" value={form.contactEmail} onChange={(event) => onChange('contactEmail', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono de contacto</span>
                    <input inputMode="numeric" value={form.contactPhone} onChange={(event) => onChange('contactPhone', sanitizeDigits(event.target.value, 8))} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Ingreso mensual estimado</span>
                    <input inputMode="numeric" value={form.estimatedMonthlyIncome} onChange={(event) => onChange('estimatedMonthlyIncome', sanitizeDigits(event.target.value))} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
                    <input type="checkbox" checked={form.usesElectronicInvoice} onChange={(event) => onToggleInvoice(event.target.checked)} className="h-4 w-4" />
                    <span className="text-sm font-medium text-[var(--app-fg)]">Usa facturación electrónica</span>
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Actividad comercial</span>
                    <input value={form.commercialActivity} onChange={(event) => onChange('commercialActivity', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Dirección del local</span>
                    <input value={form.businessAddress} onChange={(event) => onChange('businessAddress', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantón</span>
                    <input value={form.canton} onChange={(event) => onChange('canton', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Distrito</span>
                    <input value={form.district} onChange={(event) => onChange('district', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Horario comercial</span>
                    <input value={form.commercialSchedule} onChange={(event) => onChange('commercialSchedule', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cantidad de empleados</span>
                    <input inputMode="numeric" value={form.employeeCount} onChange={(event) => onChange('employeeCount', sanitizeDigits(event.target.value))} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono de contacto</span>
                    <input inputMode="numeric" value={form.patentContactPhone} onChange={(event) => onChange('patentContactPhone', sanitizeDigits(event.target.value, 8))} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
                  </label>
                </>
              )}

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Observaciones para el docente</span>
                <textarea rows={5} value={form.notes} onChange={(event) => onChange('notes', event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm outline-none" />
              </label>
            </div>
          </div>

          <div className="border-t border-[color:var(--app-border)] px-5 py-4 sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} disabled={isSaving} className={neutralActionButtonClass}>Cancelar</button>
              <button type="button" onClick={onSubmit} disabled={isSaving} className={positiveActionButtonClass}>{isSaving ? 'Enviando...' : 'Enviar solicitud'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyCompanyPage({ isDarkMode, onToggleTheme }: MyCompanyPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [operations, setOperations] = useState<MonthlyOperationRecord[]>([]);
  const [requests, setRequests] = useState<ComplianceRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<ComplianceRequestType>('tax_registration');
  const [requestMode, setRequestMode] = useState<ComplianceRequestMode>('initial');
  const [requestForm, setRequestForm] = useState<RequestFormState>(initialRequestForm);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const currentPeriodLabel = useMemo(() => {
    const now = new Date();
    return `${now.toLocaleString('es-CR', { month: 'long' })} ${now.getFullYear()}`;
  }, []);

  const latestOperation = useMemo(() => operations[0] ?? null, [operations]);
  const pendingTaxRequest = useMemo(() => getPendingRequestByType(requests, 'tax_registration'), [requests]);
  const pendingPatentRequest = useMemo(() => getPendingRequestByType(requests, 'municipal_patent'), [requests]);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => navigate('/profile');

  const loadMyCompany = async () => {
    if (!profile || profile.role !== 'student' || !profile.teamId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const companiesSnapshot = await getDocs(
        query(collection(db, 'companies'), where('teamId', '==', profile.teamId))
      );

      if (companiesSnapshot.empty) {
        setCompany(null);
        setOperations([]);
        setRequests([]);
        return;
      }

      const companyDoc = companiesSnapshot.docs[0];
      const companyData = companyDoc.data();
      const nextCompany: CompanyRecord = {
        id: companyDoc.id,
        teamId: companyData.teamId ?? '',
        teamName: companyData.teamName ?? '',
        businessName: companyData.businessName ?? '',
        tradeName: companyData.tradeName ?? '',
        legalId: companyData.legalId ?? '',
        industry: companyData.industry ?? '',
        status: companyData.status === 'registered' ? 'registered' : 'draft',
        formalRegistration: {
          societyType: companyData.formalRegistration?.societyType === 'srl' ? 'srl' : 'sa',
          legalRepresentative: companyData.formalRegistration?.legalRepresentative ?? '',
          registrationStatus:
            companyData.formalRegistration?.registrationStatus === 'registered'
              ? 'registered'
              : companyData.formalRegistration?.registrationStatus === 'in_review'
                ? 'in_review'
                : 'pending',
          taxRegistrationStatus:
            companyData.formalRegistration?.taxRegistrationStatus === 'active'
              ? 'active'
              : 'pending',
          municipalPatentStatus:
            companyData.formalRegistration?.municipalPatentStatus === 'active'
              ? 'active'
              : companyData.formalRegistration?.municipalPatentStatus === 'not_required'
                ? 'not_required'
                : 'pending',
          notes: companyData.formalRegistration?.notes ?? '',
        },
      };

      setCompany(nextCompany);

      try {
        const operationsSnapshot = await getDocs(
          query(collection(db, 'monthlyOperations'), where('teamId', '==', profile.teamId))
        );

        const nextOperations = operationsSnapshot.docs
          .map((document): MonthlyOperationRecord => {
            const data = document.data();
            return {
              id: document.id,
              companyId: data.companyId ?? '',
              periodYear: Number(data.periodYear ?? 0),
              periodMonth: Number(data.periodMonth ?? 0),
              periodLabel: data.periodLabel ?? '',
              openingCash: Number(data.openingCash ?? 0),
              totalIncome: Number(data.totalIncome ?? 0),
              totalExpenses: Number(data.totalExpenses ?? 0),
              closingCash: Number(data.closingCash ?? 0),
              netResult: Number(data.netResult ?? 0),
              status: data.status === 'closed' ? 'closed' : 'draft',
            };
          })
          .filter((operation) => operation.companyId === nextCompany.id)
          .sort((a, b) =>
            a.periodYear !== b.periodYear
              ? b.periodYear - a.periodYear
              : b.periodMonth - a.periodMonth
          );

        setOperations(nextOperations);
      } catch (error) {
        console.error('Error cargando operaciones de la empresa:', error);
        setOperations([]);
      }

      try {
        const requestsSnapshot = await getDocs(
          query(collection(db, 'companyComplianceRequests'), where('teamId', '==', profile.teamId))
        );

        const nextRequests = requestsSnapshot.docs
          .map((document): ComplianceRequestRecord => {
            const data = document.data();
            return {
              id: document.id,
              companyId: String(data.companyId ?? ''),
              companyName: String(data.companyName ?? nextCompany.tradeName),
              teamId: String(data.teamId ?? nextCompany.teamId),
              teamName: String(data.teamName ?? nextCompany.teamName),
              type: data.type === 'municipal_patent' ? 'municipal_patent' : 'tax_registration',
              mode: data.mode === 'update' ? 'update' : data.mode === 'renewal' ? 'renewal' : 'initial',
              status:
                data.status === 'approved' ||
                data.status === 'rejected' ||
                data.status === 'not_required' ||
                data.status === 'submitted'
                  ? data.status
                  : 'pending',
              legalRepresentative: String(data.legalRepresentative ?? ''),
              notes: String(data.notes ?? ''),
              submittedAt: data.submittedAt ?? null,
              reviewedAt: data.reviewedAt ?? null,
              reviewerComment: String(data.reviewerComment ?? ''),
              formData:
                typeof data.formData === 'object' && data.formData != null
                  ? (data.formData as Record<string, unknown>)
                  : {},
            };
          })
          .filter((request) => request.companyId === nextCompany.id)
          .sort((a, b) => getTimestampSortValue(b.submittedAt) - getTimestampSortValue(a.submittedAt));

        setRequests(nextRequests);
      } catch (error) {
        console.error('Error cargando historial regulatorio:', error);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error cargando empresa del estudiante:', error);
      setCompany(null);
      setOperations([]);
      setRequests([]);
      toast.error('No se pudo cargar tu empresa', 'Revisa las reglas y vuelve a intentarlo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadMyCompany();
  }, [profile]);

  const openRequestModal = (type: ComplianceRequestType) => {
    if (!company) return;

    if (type === 'tax_registration') {
      if (pendingTaxRequest) {
        toast.info('Trámite ya pendiente', 'Ya existe una solicitud de tributación en revisión.');
        return;
      }
      setRequestType(type);
      setRequestMode(company.formalRegistration.taxRegistrationStatus === 'active' ? 'update' : 'initial');
    } else {
      if (company.formalRegistration.municipalPatentStatus === 'not_required') {
        toast.info('Patente no requerida', 'Este trámite fue marcado como no requerido por el docente.');
        return;
      }
      if (pendingPatentRequest) {
        toast.info('Trámite ya pendiente', 'Ya existe una solicitud de patente en revisión.');
        return;
      }
      setRequestType(type);
      setRequestMode(company.formalRegistration.municipalPatentStatus === 'active' ? 'renewal' : 'initial');
    }

    setRequestForm(initialRequestForm);
    setIsRequestModalOpen(true);
  };

  const validateRequestForm = () => {
    if (requestType === 'tax_registration') {
      if (!requestForm.economicActivity.trim() || !requestForm.fiscalAddress.trim() || !requestForm.contactEmail.trim()) {
        toast.warning('Formulario incompleto', 'Completa actividad económica, dirección fiscal y correo de contacto.');
        return false;
      }
      if (requestForm.contactPhone.length !== 8) {
        toast.warning('Teléfono inválido', 'El teléfono de contacto debe tener 8 dígitos válidos.');
        return false;
      }
      if (!requestForm.estimatedMonthlyIncome.trim()) {
        toast.warning('Monto requerido', 'Debes indicar el ingreso mensual estimado.');
        return false;
      }
      return true;
    }

    if (!requestForm.commercialActivity.trim() || !requestForm.businessAddress.trim() || !requestForm.canton.trim() || !requestForm.district.trim()) {
      toast.warning('Formulario incompleto', 'Completa la actividad, dirección, cantón y distrito.');
      return false;
    }
    if (requestForm.employeeCount.length === 0) {
      toast.warning('Dato requerido', 'Indica la cantidad de empleados.');
      return false;
    }
    if (requestForm.patentContactPhone.length !== 8) {
      toast.warning('Teléfono inválido', 'El teléfono de contacto debe tener 8 dígitos válidos.');
      return false;
    }
    return true;
  };

  const handleSubmitRequest = async () => {
    if (!profile || !company) return;
    if (!validateRequestForm()) return;

    try {
      setIsSubmittingRequest(true);
      const formData =
        requestType === 'tax_registration'
          ? {
              economicActivity: requestForm.economicActivity.trim(),
              fiscalAddress: requestForm.fiscalAddress.trim(),
              contactEmail: requestForm.contactEmail.trim(),
              contactPhone: requestForm.contactPhone,
              estimatedMonthlyIncome: Number(requestForm.estimatedMonthlyIncome),
              usesElectronicInvoice: requestForm.usesElectronicInvoice,
            }
          : {
              commercialActivity: requestForm.commercialActivity.trim(),
              businessAddress: requestForm.businessAddress.trim(),
              canton: requestForm.canton.trim(),
              district: requestForm.district.trim(),
              commercialSchedule: requestForm.commercialSchedule.trim(),
              employeeCount: Number(requestForm.employeeCount),
              contactPhone: requestForm.patentContactPhone,
            };

      await addDoc(collection(db, 'companyComplianceRequests'), {
        companyId: company.id,
        companyName: company.tradeName,
        teamId: company.teamId,
        teamName: company.teamName,
        type: requestType,
        mode: requestMode,
        status: 'pending',
        legalRepresentative: company.formalRegistration.legalRepresentative,
        notes: requestForm.notes.trim(),
        reviewerComment: '',
        submittedBy: profile.uid,
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        formData,
      });

      toast.success('Solicitud enviada', 'El trámite fue enviado correctamente para revisión docente.');
      setIsRequestModalOpen(false);
      setRequestForm(initialRequestForm);
      await loadMyCompany();
    } catch {
      toast.error('No se pudo enviar la solicitud', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const taxActionLabel = pendingTaxRequest
    ? 'Pendiente de revisión'
    : company?.formalRegistration.taxRegistrationStatus === 'active'
      ? 'Actualizar tributación'
      : 'Solicitar tributación';

  const patentActionLabel = company?.formalRegistration.municipalPatentStatus === 'not_required'
    ? 'Patente no requerida'
    : pendingPatentRequest
      ? 'Pendiente de revisión'
      : company?.formalRegistration.municipalPatentStatus === 'active'
        ? 'Renovar patente municipal'
        : 'Solicitar patente municipal';

  return (
    <>
      <AppShell
        title="Mi empresa"
        subtitle="Resumen de tu empresa, solicitudes regulatorias y operación mensual."
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
        onOpenProfile={handleOpenProfile}
      >
        {!profile ? (
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm"><div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Cargando sesión...</div></section>
        ) : profile.role !== 'student' ? (
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm"><div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Esta vista está disponible únicamente para estudiantes.</div></section>
        ) : isLoading ? (
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm"><div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Cargando información de la empresa...</div></section>
        ) : !profile.teamId ? (
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm"><div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Aún no estás asignado a un equipo.</div></section>
        ) : !company ? (
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm"><div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Tu equipo todavía no tiene una empresa registrada.</div></section>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">{company.tradeName}</h2>
                    <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">{company.teamName}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Empresa asignada a tu equipo para la práctica actual.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => navigate(`/company-operations/${company.id}`)} className={positiveActionButtonClass}>Abrir operación mensual</button>
                  <button type="button" onClick={() => navigate(`/company-operations/${company.id}`)} className={neutralActionButtonClass}>Ir al período {currentPeriodLabel}</button>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div>
                <h3 className="text-lg font-semibold">Solicitudes regulatorias</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Aquí es donde tu equipo solicita tributación o patente. El docente revisa después desde su panel de solicitudes.</p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openRequestModal('tax_registration')}
                  disabled={Boolean(pendingTaxRequest)}
                  className={[
                    'flex items-center justify-between gap-4 rounded-3xl border px-6 py-5 text-left transition',
                    pendingTaxRequest
                      ? 'cursor-not-allowed border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500'
                      : 'border-transparent bg-emerald-500 text-white hover:bg-emerald-600',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-[clamp(1.2rem,1.7vw,1.9rem)] font-semibold leading-tight tracking-tight">{taxActionLabel}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-white/80">Tributación</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-lg">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => openRequestModal('municipal_patent')}
                  disabled={Boolean(pendingPatentRequest) || company.formalRegistration.municipalPatentStatus === 'not_required'}
                  className={[
                    'flex items-center justify-between gap-4 rounded-3xl border px-6 py-5 text-left transition',
                    pendingPatentRequest || company.formalRegistration.municipalPatentStatus === 'not_required'
                      ? 'cursor-not-allowed border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500'
                      : 'border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-fg)] hover:bg-[var(--app-surface)]',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-[clamp(1.2rem,1.7vw,1.9rem)] font-semibold leading-tight tracking-tight">{patentActionLabel}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Municipalidad</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] text-lg">→</span>
                </button>
              </div>

              <div className="mt-4 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
                Mientras exista una solicitud pendiente de un tipo, ese botón queda bloqueado. Cuando ya fue aprobada, el sistema cambia a <span className="font-semibold text-[var(--app-fg)]">Actualizar</span> o <span className="font-semibold text-[var(--app-fg)]">Renovar</span> según corresponda.
              </div>

              <div className="mt-6 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-lg font-semibold text-[var(--app-fg)]">Historial reciente</h4>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{requests.length} registro(s)</span>
                </div>

                {requests.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-[color:var(--app-border)] border-dashed bg-[var(--app-surface)] px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                    Todavía no hay solicitudes enviadas.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {requests.slice(0, 4).map((request) => (
                      <article key={request.id} className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--app-fg)]">{getRequestTypeLabel(request.type)}</p>
                          <span className={['inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold', getRequestStatusClass(request.status)].join(' ')}>{getRequestStatusLabel(request.status)}</span>
                        </div>
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{getRequestModeLabel(request.mode)}</p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Solicitud: {formatDateTime(request.submittedAt)}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Resultado: {request.status === 'approved' || request.status === 'rejected' || request.status === 'not_required' ? formatDateTime(request.reviewedAt) : 'Pendiente'}</p>
                        {request.reviewerComment ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Comentario docente: {request.reviewerComment}</p> : null}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
              <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
                <header className="mb-5"><h3 className="text-lg font-semibold">Datos de la empresa</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Información base con la que trabajará tu equipo.</p></header>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Nombre legal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.businessName}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Nombre comercial</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.tradeName}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Cédula jurídica</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.legalId}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Industria</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.industry}</p></div>
                </div>
              </section>

              <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
                <header className="mb-5"><h3 className="text-lg font-semibold">Estado formal</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Resumen simplificado del estado actual.</p></header>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Inscripción</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getRegistrationStatusLabel(company.formalRegistration.registrationStatus)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Tributación</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getTaxStatusLabel(company.formalRegistration.taxRegistrationStatus)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Patente municipal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getPatentStatusLabel(company.formalRegistration.municipalPatentStatus)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Representante legal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.formalRegistration.legalRepresentative.trim() || 'Sin definir'}</p></div>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5"><h3 className="text-lg font-semibold">Operación mensual</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Resumen de períodos operativos registrados por tu equipo.</p></header>
              {latestOperation ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-[var(--app-fg)]">Último período registrado</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{latestOperation.periodLabel}</p></div><span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">{latestOperation.status === 'closed' ? 'Cerrado' : 'Borrador'}</span></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Caja inicial</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(latestOperation.openingCash)}</p></div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Ingresos</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(latestOperation.totalIncome)}</p></div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Gastos</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(latestOperation.totalExpenses)}</p></div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Resultado</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(latestOperation.netResult)}</p></div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5"><p className="text-sm font-medium text-[var(--app-fg)]">Acción rápida</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Continúa o actualiza la operación del período actual.</p><div className="mt-5 flex flex-col gap-3"><button type="button" onClick={() => navigate(`/company-operations/${company.id}`)} className={positiveActionButtonClass}>Abrir operación mensual</button><button type="button" onClick={() => navigate(`/company-operations/${company.id}`)} className={neutralActionButtonClass}>Ver historial operativo</button></div></div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Tu equipo todavía no ha registrado ningún período operativo.</div>
              )}
            </section>
          </div>
        )}
      </AppShell>

      {isRequestModalOpen && company ? (
        <StudentRequestModal
          type={requestType}
          mode={requestMode}
          form={requestForm}
          legalRepresentative={company.formalRegistration.legalRepresentative}
          onClose={() => {
            if (!isSubmittingRequest) setIsRequestModalOpen(false);
          }}
          onChange={(field, value) => setRequestForm((current) => ({ ...current, [field]: value }))}
          onToggleInvoice={(checked) => setRequestForm((current) => ({ ...current, usesElectronicInvoice: checked }))}
          onSubmit={() => void handleSubmitRequest()}
          isSaving={isSubmittingRequest}
        />
      ) : null}
    </>
  );
}
