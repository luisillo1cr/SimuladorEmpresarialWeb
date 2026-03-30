export type FormalRegistrationStatus = 'pending' | 'in_review' | 'registered';
export type TaxRegistrationStatus = 'pending' | 'active';
export type MunicipalPatentStatus = 'pending' | 'active' | 'not_required';
export type ComplianceRequestType = 'tax_registration' | 'municipal_patent';
export type ComplianceDecisionStatus = 'submitted' | 'pending' | 'approved' | 'rejected' | 'not_required';
export type ComplianceRequestStatus = ComplianceDecisionStatus;
export type ComplianceRequestMode = 'initial' | 'update' | 'renewal';

export type FirestoreTimestampLike =
  | { seconds?: number | null; nanoseconds?: number | null; toDate?: () => Date }
  | Date
  | string
  | number
  | null
  | undefined;

export type ComplianceRequestFormData = {
  taxAdministration?: string;
  economicActivity?: string;
  businessAddress?: string;
  estimatedMonthlyIncome?: string;
  taxStartDate?: string;
  municipality?: string;
  district?: string;
  activityDescription?: string;
  premiseType?: string;
  patentStartDate?: string;
  [key: string]: unknown;
};

export type ComplianceRequestRecord = {
  id: string;
  companyId: string;
  companyName: string;
  teamId: string;
  teamName: string;
  type: ComplianceRequestType;
  mode: ComplianceRequestMode;
  status: ComplianceDecisionStatus;
  legalRepresentative: string;
  reviewerComment: string;
  notes: string;
  submittedAt: FirestoreTimestampLike;
  reviewedAt: FirestoreTimestampLike;
  formData?: ComplianceRequestFormData;
};

export type FormalRegistrationSnapshot = {
  societyType: 'sa' | 'srl';
  legalRepresentative: string;
  registrationStatus: FormalRegistrationStatus;
  taxRegistrationStatus: TaxRegistrationStatus;
  municipalPatentStatus: MunicipalPatentStatus;
  notes: string;
};

function normalizeDecisionStatus(status: unknown): ComplianceDecisionStatus {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'not_required':
      return 'not_required';
    case 'submitted':
      return 'submitted';
    case 'pending':
    default:
      return 'pending';
  }
}

export function getRequestTypeLabel(type: ComplianceRequestType) {
  return type === 'municipal_patent' ? 'Patente municipal' : 'Inscripción tributaria';
}

export function getRequestModeLabel(mode: ComplianceRequestMode, _type?: ComplianceRequestType) {
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

export function getRequestStatusLabel(status: ComplianceDecisionStatus) {
  switch (normalizeDecisionStatus(status)) {
    case 'approved':
      return 'Aprobada';
    case 'rejected':
      return 'Rechazada';
    case 'not_required':
      return 'No requerida';
    case 'submitted':
    case 'pending':
    default:
      return 'Pendiente';
  }
}

export function getRequestStatusClass(status: ComplianceDecisionStatus) {
  switch (normalizeDecisionStatus(status)) {
    case 'approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300';
    case 'not_required':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
    case 'submitted':
    case 'pending':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  }
}


export function getComplianceFormFieldLabel(key: string) {
  const labels: Record<string, string> = {
    taxAdministration: 'Administración tributaria',
    economicActivity: 'Actividad económica',
    businessAddress: 'Dirección fiscal',
    estimatedMonthlyIncome: 'Ingreso mensual estimado',
    taxStartDate: 'Inicio de actividades',
    municipality: 'Cantón / Municipalidad',
    district: 'Distrito',
    activityDescription: 'Actividad comercial',
    premiseType: 'Tipo de local',
    patentStartDate: 'Inicio de operación',
    contactEmail: 'Correo de contacto',
    contactPhone: 'Teléfono de contacto',
    electronicInvoicing: 'Facturación electrónica',
    localAddress: 'Dirección del local',
    businessHours: 'Horario comercial',
    employeeCount: 'Cantidad de empleados',
    observations: 'Observaciones',
  };

  return labels[key] ?? key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (value) => value.toUpperCase());
}

export function formatComplianceFormValue(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

export function getTaxStatusLabel(status: TaxRegistrationStatus, hasPendingRequest = false) {
  if (hasPendingRequest) return 'Pendiente de revisión';
  return status === 'active' ? 'Activa' : 'Pendiente';
}

export function getPatentStatusLabel(status: MunicipalPatentStatus, hasPendingRequest = false) {
  if (hasPendingRequest) return 'Pendiente de revisión';
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

export function getRegistrationStatusLabel(status: FormalRegistrationStatus) {
  switch (status) {
    case 'registered':
      return 'Formalizada';
    case 'in_review':
      return 'En revisión';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

export function getRegistrationStatusBadgeClass(status: FormalRegistrationStatus) {
  switch (status) {
    case 'registered':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'in_review':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
    case 'pending':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300';
  }
}

export function getRegistrationStatusValueClassName(status: FormalRegistrationStatus) {
  switch (status) {
    case 'registered':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'in_review':
      return 'text-amber-700 dark:text-amber-300';
    case 'pending':
    default:
      return 'text-slate-700 dark:text-slate-200';
  }
}

export function getTaxStatusBadgeClass(status: TaxRegistrationStatus, hasPendingRequest = false) {
  if (hasPendingRequest) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return status === 'active'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300';
}

export function getPatentStatusBadgeClass(status: MunicipalPatentStatus, hasPendingRequest = false) {
  if (hasPendingRequest) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  }
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'not_required':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
    case 'pending':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300';
  }
}

export function toDate(value: FirestoreTimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
  }
  return null;
}

export function formatDateTime(value: FirestoreTimestampLike) {
  const parsed = toDate(value);
  if (!parsed) return '—';
  return parsed.toLocaleString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTimestamp(value: FirestoreTimestampLike) {
  return formatDateTime(value);
}

export function sortByNewest<T extends { submittedAt?: FirestoreTimestampLike | null }>(records: T[]) {
  return [...records].sort((a, b) => {
    const aMillis = toDate(a.submittedAt ?? null)?.getTime() ?? 0;
    const bMillis = toDate(b.submittedAt ?? null)?.getTime() ?? 0;
    return bMillis - aMillis;
  });
}

export function sortRequestsBySubmittedAtDesc<T extends { submittedAt?: FirestoreTimestampLike | null }>(records: T[]) {
  return sortByNewest(records);
}

export function getLatestRequestByType<T extends { type: ComplianceRequestType; submittedAt?: FirestoreTimestampLike | null }>(
  records: T[],
  type: ComplianceRequestType
) {
  return sortByNewest(records.filter((record) => record.type === type))[0] ?? null;
}

export function hasPendingRequest<T extends { type: ComplianceRequestType; status?: ComplianceDecisionStatus | null }>(
  records: T[],
  type: ComplianceRequestType
) {
  return records.some((record) => record.type === type && ['pending', 'submitted'].includes(String(record.status ?? '')));
}

export function getNextMode(
  type: ComplianceRequestType,
  currentState: FormalRegistrationSnapshot
): ComplianceRequestMode {
  if (type === 'tax_registration') {
    return currentState.taxRegistrationStatus === 'active' ? 'update' : 'initial';
  }
  return currentState.municipalPatentStatus === 'active' ? 'renewal' : 'initial';
}

export function getStudentActionLabel(
  type: ComplianceRequestType,
  currentState: FormalRegistrationSnapshot,
  requests: Array<{ type: ComplianceRequestType; status?: ComplianceDecisionStatus | null }>
) {
  if (type === 'tax_registration') {
    if (hasPendingRequest(requests, type)) return 'Pendiente de revisión';
    return currentState.taxRegistrationStatus === 'active' ? 'Actualizar tributación' : 'Solicitar tributación';
  }

  if (hasPendingRequest(requests, type)) return 'Pendiente de revisión';
  if (currentState.municipalPatentStatus === 'not_required') return 'Patente no requerida';
  return currentState.municipalPatentStatus === 'active' ? 'Renovar patente municipal' : 'Solicitar patente municipal';
}

export function getStudentActionDisabled(
  type: ComplianceRequestType,
  currentState: FormalRegistrationSnapshot,
  requests: Array<{ type: ComplianceRequestType; status?: ComplianceDecisionStatus | null }>
) {
  if (hasPendingRequest(requests, type)) return true;
  return type === 'municipal_patent' && currentState.municipalPatentStatus === 'not_required';
}

export function deriveFormalRegistration(
  currentState: FormalRegistrationSnapshot,
  requests: Array<{ type: ComplianceRequestType; status?: ComplianceDecisionStatus | null; submittedAt?: FirestoreTimestampLike | null }>
): FormalRegistrationSnapshot {
  const nextState: FormalRegistrationSnapshot = { ...currentState };

  const latestTax = getLatestRequestByType(requests, 'tax_registration');
  const latestPatent = getLatestRequestByType(requests, 'municipal_patent');

  if (latestTax && normalizeDecisionStatus(latestTax.status) === 'approved') {
    nextState.taxRegistrationStatus = 'active';
  } else if (
    latestTax &&
    normalizeDecisionStatus(latestTax.status) === 'rejected' &&
    currentState.taxRegistrationStatus !== 'active'
  ) {
    nextState.taxRegistrationStatus = 'pending';
  }

  if (latestPatent && normalizeDecisionStatus(latestPatent.status) === 'approved') {
    nextState.municipalPatentStatus = 'active';
  } else if (latestPatent && normalizeDecisionStatus(latestPatent.status) === 'not_required') {
    nextState.municipalPatentStatus = 'not_required';
  } else if (
    latestPatent &&
    normalizeDecisionStatus(latestPatent.status) === 'rejected' &&
    currentState.municipalPatentStatus !== 'active' &&
    currentState.municipalPatentStatus !== 'not_required'
  ) {
    nextState.municipalPatentStatus = 'pending';
  }

  const hasPending = requests.some((request) => {
    const status = normalizeDecisionStatus(request.status);
    return status === 'pending' || status === 'submitted';
  });

  const isRegistered =
    nextState.taxRegistrationStatus === 'active' &&
    (nextState.municipalPatentStatus === 'active' || nextState.municipalPatentStatus === 'not_required');

  if (isRegistered) nextState.registrationStatus = 'registered';
  else if (hasPending) nextState.registrationStatus = 'in_review';
  else nextState.registrationStatus = 'pending';

  return nextState;
}

export function deriveFormalRegistrationState(args: {
  taxStatus: TaxRegistrationStatus;
  patentStatus: MunicipalPatentStatus;
  hasPendingRequests?: boolean;
}) {
  const { taxStatus, patentStatus, hasPendingRequests = false } = args;
  const isRegistered = taxStatus === 'active' && (patentStatus === 'active' || patentStatus === 'not_required');
  const registrationStatus: FormalRegistrationStatus = isRegistered
    ? 'registered'
    : hasPendingRequests
      ? 'in_review'
      : 'pending';
  const companyStatus: 'draft' | 'registered' = isRegistered ? 'registered' : 'draft';
  return { registrationStatus, companyStatus };
}

export function getFormalStatusSummary(state: FormalRegistrationSnapshot) {
  return {
    registration: getRegistrationStatusLabel(state.registrationStatus),
    tax: getTaxStatusLabel(state.taxRegistrationStatus),
    patent: getPatentStatusLabel(state.municipalPatentStatus),
  };
}
