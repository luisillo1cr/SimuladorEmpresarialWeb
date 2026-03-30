import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../utils/toast';
import {
  negativeActionButtonClass,
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';
import {
  deriveFormalRegistrationState,
  getPatentStatusBadgeClass,
  getPatentStatusLabel,
  getRegistrationStatusBadgeClass,
  getRegistrationStatusLabel,
  getTaxStatusBadgeClass,
  getTaxStatusLabel,
  type FormalRegistrationStatus,
  type MunicipalPatentStatus,
  type TaxRegistrationStatus,
} from '../utils/compliance';

type CompaniesPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type TeamRecord = {
  id: string;
  name: string;
  memberIds: string[];
  memberNames: string[];
};

type CompanyStatus = 'draft' | 'registered';

type CompanyRecord = {
  id: string;
  teamId: string;
  teamName: string;
  businessName: string;
  tradeName: string;
  legalId: string;
  industry: string;
  status: CompanyStatus;
  formalRegistration: {
    registrationStatus: FormalRegistrationStatus;
    taxRegistrationStatus: TaxRegistrationStatus;
    municipalPatentStatus: MunicipalPatentStatus;
  };
  pendingTaxRequest: boolean;
  pendingPatentRequest: boolean;
  pendingRequestsCount: number;
};

type CompanyFilterValue = 'all' | 'registered' | 'in_review' | 'pending';

function getCompanyStatusLabel(status: CompanyStatus) {
  switch (status) {
    case 'registered':
      return 'Inscrita';
    case 'draft':
    default:
      return 'Borrador';
  }
}

function getCompanyStatusBadgeClass(status: CompanyStatus) {
  switch (status) {
    case 'registered':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'draft':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
  }
}

function generateMockLegalId(typeCode = '101') {
  const consecutive = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

  return `3-${typeCode}-${consecutive}`;
}

function ConfirmDiscardModal({
  title,
  description,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-[var(--app-fg)]">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className={neutralActionButtonClass}>
            Seguir editando
          </button>
          <button type="button" onClick={onConfirm} className={negativeActionButtonClass}>
            Cerrar sin guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex min-h-dvh items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--app-fg)] sm:text-2xl">
                {title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {description}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500 transition hover:text-[var(--app-fg)]"
              aria-label="Cerrar modal"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>

          <div className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompaniesPage({
  isDarkMode,
  onToggleTheme,
}: CompaniesPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<CompanyFilterValue>('all');
  const [companySearch, setCompanySearch] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [legalId, setLegalId] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState<CompanyStatus>('draft');
  const [isSaving, setIsSaving] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(
    null
  );
  const [editSelectedTeamId, setEditSelectedTeamId] = useState('');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editLegalId, setEditLegalId] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editStatus, setEditStatus] = useState<CompanyStatus>('draft');
  const [isUpdating, setIsUpdating] = useState(false);

  const [companyToDelete, setCompanyToDelete] = useState<CompanyRecord | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [closeTarget, setCloseTarget] = useState<'create' | 'edit' | null>(null);

  const availableTeams = useMemo(() => {
    const usedTeamIds = new Set(companies.map((company) => company.teamId));
    return teams.filter((team) => !usedTeamIds.has(team.id));
  }, [teams, companies]);

  const selectedTeam = useMemo(() => {
    return availableTeams.find((team) => team.id === selectedTeamId) ?? null;
  }, [availableTeams, selectedTeamId]);

  const editableTeams = useMemo(() => {
    if (!selectedCompany) {
      return [];
    }

    const usedTeamIds = new Set(
      companies
        .filter((company) => company.id !== selectedCompany.id)
        .map((company) => company.teamId)
    );

    return teams.filter((team) => !usedTeamIds.has(team.id));
  }, [teams, companies, selectedCompany]);

  const editSelectedTeam = useMemo(() => {
    return editableTeams.find((team) => team.id === editSelectedTeamId) ?? null;
  }, [editableTeams, editSelectedTeamId]);

  const createModalHasUnsavedChanges =
    Boolean(selectedTeamId) ||
    Boolean(businessName.trim()) ||
    Boolean(tradeName.trim()) ||
    Boolean(legalId.trim()) ||
    Boolean(industry.trim()) ||
    status !== 'draft';

  const editModalHasUnsavedChanges = Boolean(
    selectedCompany &&
      (
        editSelectedTeamId !== selectedCompany.teamId ||
        editBusinessName.trim() !== selectedCompany.businessName ||
        editTradeName.trim() !== selectedCompany.tradeName ||
        editLegalId.trim() !== selectedCompany.legalId ||
        editIndustry.trim() !== selectedCompany.industry ||
        editStatus !== selectedCompany.status
      )
  );

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  const handleOpenCompanyDetail = (companyId: string) => {
    navigate(`/admin/companies/${companyId}`);
  };

  const loadCompanies = async () => {
    try {
      setIsLoadingCompanies(true);

      const companiesRef = collection(db, 'companies');
      const companiesQuery = query(companiesRef, orderBy('tradeName'));
      const requestsRef = collection(db, 'companyComplianceRequests');
      const requestsQuery = query(requestsRef, orderBy('submittedAt', 'desc'));

      const [companiesSnapshot, requestsSnapshot] = await Promise.all([
        getDocs(companiesQuery),
        getDocs(requestsQuery),
      ]);

      const pendingRequestMap = requestsSnapshot.docs.reduce<Record<string, { tax: boolean; patent: boolean; total: number }>>((accumulator, document) => {
        const data = document.data();
        if (!['pending', 'submitted'].includes(String(data.status ?? ''))) return accumulator;

        const companyId = String(data.companyId ?? '');
        if (!companyId) return accumulator;

        const current = accumulator[companyId] ?? { tax: false, patent: false, total: 0 };
        const type = data.type === 'municipal_patent' ? 'municipal_patent' : 'tax_registration';

        accumulator[companyId] = {
          tax: current.tax || type === 'tax_registration',
          patent: current.patent || type === 'municipal_patent',
          total: current.total + 1,
        };

        return accumulator;
      }, {});

      const nextCompanies: CompanyRecord[] = companiesSnapshot.docs.map((document) => {
        const data = document.data();
        const pendingMeta = pendingRequestMap[document.id] ?? { tax: false, patent: false, total: 0 };
        const taxRegistrationStatus: TaxRegistrationStatus = data.formalRegistration?.taxRegistrationStatus === 'active' ? 'active' : 'pending';
        const municipalPatentStatus: MunicipalPatentStatus = data.formalRegistration?.municipalPatentStatus === 'active'
          ? 'active'
          : data.formalRegistration?.municipalPatentStatus === 'not_required'
            ? 'not_required'
            : 'pending';

        const derived = deriveFormalRegistrationState({
          taxStatus: taxRegistrationStatus,
          patentStatus: municipalPatentStatus,
          hasPendingRequests: pendingMeta.total > 0,
        });

        return {
          id: document.id,
          teamId: data.teamId ?? '',
          teamName: data.teamName ?? '',
          businessName: data.businessName ?? '',
          tradeName: data.tradeName ?? '',
          legalId: data.legalId ?? '',
          industry: data.industry ?? '',
          status: derived.companyStatus,
          formalRegistration: {
            registrationStatus: derived.registrationStatus,
            taxRegistrationStatus,
            municipalPatentStatus,
          },
          pendingTaxRequest: pendingMeta.tax,
          pendingPatentRequest: pendingMeta.patent,
          pendingRequestsCount: pendingMeta.total,
        };
      });

      setCompanies(nextCompanies);
    } catch {
      toast.error(
        'No se pudieron cargar las empresas',
        'Revisa las reglas de Firestore y la colección companies.'
      );
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const loadTeams = async () => {
    try {
      const teamsRef = collection(db, 'teams');
      const teamsQuery = query(teamsRef, orderBy('name'));
      const snapshot = await getDocs(teamsQuery);

      const nextTeams: TeamRecord[] = snapshot.docs.map((document) => {
        const data = document.data();

        return {
          id: document.id,
          name: data.name ?? '',
          memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
          memberNames: Array.isArray(data.memberNames) ? data.memberNames : [],
        };
      });

      setTeams(nextTeams);
    } catch {
      toast.error(
        'No se pudieron cargar los equipos',
        'Revisa las reglas de Firestore y la colección teams.'
      );
    }
  };

  useEffect(() => {
    void Promise.all([loadCompanies(), loadTeams()]);
  }, []);

  const companyMetrics = useMemo(() => {
    return companies.reduce(
      (accumulator, company) => {
        const registrationStatus = company.formalRegistration.registrationStatus;
        if (registrationStatus === 'registered') accumulator.registered += 1;
        if (registrationStatus === 'in_review') accumulator.inReview += 1;
        if (registrationStatus === 'pending') accumulator.pending += 1;
        if (company.pendingRequestsCount > 0) accumulator.withOpenRequests += 1;
        if (company.formalRegistration.municipalPatentStatus === 'not_required') accumulator.patentNotRequired += 1;
        return accumulator;
      },
      { registered: 0, inReview: 0, pending: 0, withOpenRequests: 0, patentNotRequired: 0 }
    );
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = companySearch.trim().toLowerCase();

    const byStatus = companies.filter((company) => {
      switch (companyFilter) {
        case 'registered':
          return company.formalRegistration.registrationStatus === 'registered';
        case 'in_review':
          return company.formalRegistration.registrationStatus === 'in_review';
        case 'pending':
          return company.formalRegistration.registrationStatus === 'pending';
        case 'all':
        default:
          return true;
      }
    });

    const bySearch = normalizedSearch
      ? byStatus.filter((company) =>
          [
            company.tradeName,
            company.businessName,
            company.teamName,
            company.legalId,
            company.industry,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : byStatus;

    return [...bySearch].sort((a, b) => {
      if (a.pendingRequestsCount !== b.pendingRequestsCount) {
        return b.pendingRequestsCount - a.pendingRequestsCount;
      }

      return a.tradeName.localeCompare(b.tradeName, 'es');
    });
  }, [companies, companyFilter, companySearch]);

  const resetCreateForm = () => {
    setSelectedTeamId('');
    setBusinessName('');
    setTradeName('');
    setLegalId('');
    setIndustry('');
    setStatus('draft');
  };

  const closeCreateModalNow = () => {
    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  const handleCloseCreateModal = () => {
    if (isSaving) {
      return;
    }

    if (createModalHasUnsavedChanges) {
      setCloseTarget('create');
      return;
    }

    closeCreateModalNow();
  };

  const handleGenerateLegalId = () => {
    setLegalId(generateMockLegalId());
    toast.success(
      'Cédula jurídica generada',
      'Se generó una cédula jurídica simulada con formato costarricense.'
    );
  };

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTeam) {
      toast.warning(
        'Equipo requerido',
        'Debes seleccionar un equipo para la empresa.'
      );
      return;
    }

    if (!businessName.trim()) {
      toast.warning(
        'Nombre legal requerido',
        'Debes ingresar el nombre legal de la empresa.'
      );
      return;
    }

    if (!tradeName.trim()) {
      toast.warning(
        'Nombre comercial requerido',
        'Debes ingresar el nombre comercial de la empresa.'
      );
      return;
    }

    if (!legalId.trim()) {
      toast.warning(
        'Cédula jurídica requerida',
        'Debes ingresar la cédula jurídica simulada.'
      );
      return;
    }

    if (!industry.trim()) {
      toast.warning(
        'Industria requerida',
        'Debes ingresar la industria o actividad económica.'
      );
      return;
    }

    try {
      setIsSaving(true);

      const companyRef = doc(collection(db, 'companies'));

      await setDoc(companyRef, {
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        businessName: businessName.trim(),
        tradeName: tradeName.trim(),
        legalId: legalId.trim(),
        industry: industry.trim(),
        status,
        createdBy: profile?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        formalRegistration: {
          societyType: 'sa',
          legalRepresentative: '',
          registrationStatus: 'pending',
          taxRegistrationStatus: 'pending',
          municipalPatentStatus: 'pending',
          notes: '',
        },
      });

      toast.success(
        'Empresa creada',
        'La empresa fue registrada correctamente para el equipo seleccionado.'
      );

      closeCreateModalNow();

      await Promise.all([loadCompanies(), loadTeams()]);
    } catch {
      toast.error(
        'No se pudo crear la empresa',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditModal = (company: CompanyRecord) => {
    setSelectedCompany(company);
    setEditSelectedTeamId(company.teamId);
    setEditBusinessName(company.businessName);
    setEditTradeName(company.tradeName);
    setEditLegalId(company.legalId);
    setEditIndustry(company.industry);
    setEditStatus(company.status);
  };

  const resetEditForm = () => {
    setSelectedCompany(null);
    setEditSelectedTeamId('');
    setEditBusinessName('');
    setEditTradeName('');
    setEditLegalId('');
    setEditIndustry('');
    setEditStatus('draft');
  };

  const closeEditModalNow = () => {
    resetEditForm();
  };

  const handleCloseEditModal = () => {
    if (isUpdating) {
      return;
    }

    if (editModalHasUnsavedChanges) {
      setCloseTarget('edit');
      return;
    }

    closeEditModalNow();
  };

  const handleConfirmDiscardChanges = () => {
    if (closeTarget === 'create') {
      closeCreateModalNow();
    } else if (closeTarget === 'edit') {
      closeEditModalNow();
    }

    setCloseTarget(null);
  };

  const handleUpdateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCompany) {
      return;
    }

    if (!editSelectedTeam) {
      toast.warning(
        'Equipo requerido',
        'Debes seleccionar un equipo para la empresa.'
      );
      return;
    }

    if (!editBusinessName.trim()) {
      toast.warning(
        'Nombre legal requerido',
        'Debes ingresar el nombre legal de la empresa.'
      );
      return;
    }

    if (!editTradeName.trim()) {
      toast.warning(
        'Nombre comercial requerido',
        'Debes ingresar el nombre comercial de la empresa.'
      );
      return;
    }

    if (!editIndustry.trim()) {
      toast.warning(
        'Industria requerida',
        'Debes ingresar la industria o actividad económica.'
      );
      return;
    }

    try {
      setIsUpdating(true);

      const companyRef = doc(db, 'companies', selectedCompany.id);

      await updateDoc(companyRef, {
        teamId: editSelectedTeam.id,
        teamName: editSelectedTeam.name,
        businessName: editBusinessName.trim(),
        tradeName: editTradeName.trim(),
        legalId: editLegalId.trim(),
        industry: editIndustry.trim(),
        status: editStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Empresa actualizada',
        'Los cambios de la empresa se guardaron correctamente.'
      );

      closeEditModalNow();
      await Promise.all([loadCompanies(), loadTeams()]);
    } catch {
      toast.error(
        'No se pudo actualizar la empresa',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenDeleteModal = (company: CompanyRecord) => {
    setCompanyToDelete(company);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) {
      return;
    }

    setCompanyToDelete(null);
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) {
      return;
    }

    try {
      setIsDeleting(true);

      await deleteDoc(doc(db, 'companies', companyToDelete.id));

      toast.success(
        'Empresa eliminada',
        'La empresa fue eliminada correctamente.'
      );

      setCompanyToDelete(null);
      await Promise.all([loadCompanies(), loadTeams()]);
    } catch {
      toast.error(
        'No se pudo eliminar la empresa',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AppShell
        title="Empresas"
        subtitle="Registra y administra una empresa simulada por equipo."
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
        onOpenProfile={handleOpenProfile}
      >
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-6">
          <header className="mb-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Listado de empresas</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Crea una empresa por equipo y controla de inmediato su estado formal, tributación y patente.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Empresas totales</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{companies.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Formalizadas</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{companyMetrics.registered}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">En revisión</p>
                <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">{companyMetrics.inReview}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Pendientes</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{companyMetrics.pending}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Con trámite abierto</p>
                <p className="mt-2 text-2xl font-semibold text-sky-700 dark:text-sky-300">{companyMetrics.withOpenRequests}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] xl:items-end">
                <div>
                  <label htmlFor="companyFilter" className="mb-2 block text-xs text-slate-500 dark:text-slate-400">Filtrar por estado formal</label>
                  <select
                    id="companyFilter"
                    value={companyFilter}
                    onChange={(event) => setCompanyFilter(event.target.value as CompanyFilterValue)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="all">Todas</option>
                    <option value="registered">Formalizadas</option>
                    <option value="in_review">En revisión</option>
                    <option value="pending">Pendientes</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="companySearch" className="mb-2 block text-xs text-slate-500 dark:text-slate-400">Buscar empresa</label>
                  <input
                    id="companySearch"
                    type="text"
                    value={companySearch}
                    onChange={(event) => setCompanySearch(event.target.value)}
                    placeholder="Nombre, equipo, cédula o industria"
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5">Mostrando {filteredCompanies.length} empresa(s)</span>
                  <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5">Patente no requerida: {companyMetrics.patentNotRequired}</span>
                  {companySearch.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCompanySearch('')}
                      className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 font-medium text-slate-600 transition hover:text-[var(--app-fg)] dark:text-slate-300"
                    >
                      Limpiar búsqueda
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          {isLoadingCompanies ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              Cargando empresas...
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="group flex h-full min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-center transition hover:bg-[var(--app-surface)]"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-400 text-slate-500 transition group-hover:border-[color:var(--action-positive-border)] group-hover:text-[var(--action-positive-border)] dark:border-slate-500 dark:text-slate-400">
                  <span className="text-4xl font-semibold leading-none">+</span>
                </div>

                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  Crear empresa
                </h3>

                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Registra una empresa simulada y asígnala a un equipo disponible.
                </p>

                <span className="mt-4 text-sm font-medium text-[var(--action-positive-border)]">
                  Nueva acción
                </span>
              </button>

              {filteredCompanies.length === 0 ? (
                <div className="flex h-full min-h-[260px] items-center justify-center rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  {companySearch.trim() || companyFilter !== 'all'
                    ? 'No hay empresas que coincidan con el filtro o la búsqueda aplicada.'
                    : 'Todavía no hay empresas creadas. Usa la tarjeta de la izquierda para registrar la primera.'}
                </div>
              ) : (
                filteredCompanies.map((company) => (
                  <article
                    key={company.id}
                    className="h-full overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)]"
                  >
                    <div className="flex h-full flex-col px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-xl font-semibold tracking-tight text-[var(--app-fg)]">
                              {company.tradeName}
                            </h3>

                            <span
                              className={[
                                'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                                getRegistrationStatusBadgeClass(company.formalRegistration.registrationStatus),
                              ].join(' ')}
                            >
                              {getRegistrationStatusLabel(company.formalRegistration.registrationStatus)}
                            </span>

                            <span
                              className={[
                                'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                                getCompanyStatusBadgeClass(company.status),
                              ].join(' ')}
                            >
                              {getCompanyStatusLabel(company.status)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Empresa asignada al equipo {company.teamName}.
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={[
                              'inline-flex rounded-full border px-3 py-1 text-[11px] font-medium',
                              getTaxStatusBadgeClass(company.formalRegistration.taxRegistrationStatus, company.pendingTaxRequest),
                            ].join(' ')}>
                              Tributación: {getTaxStatusLabel(company.formalRegistration.taxRegistrationStatus, company.pendingTaxRequest)}
                            </span>
                            <span className={[
                              'inline-flex rounded-full border px-3 py-1 text-[11px] font-medium',
                              getPatentStatusBadgeClass(company.formalRegistration.municipalPatentStatus, company.pendingPatentRequest),
                            ].join(' ')}>
                              Patente: {getPatentStatusLabel(company.formalRegistration.municipalPatentStatus, company.pendingPatentRequest)}
                            </span>
                            {company.pendingRequestsCount > 0 ? (
                              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
                                {company.pendingRequestsCount} trámite(s) abierto(s)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            Cédula
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[var(--app-fg)]">
                            {company.legalId}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            Industria
                          </p>
                          <p className="mt-2 text-sm font-semibold text-[var(--app-fg)]">
                            {company.industry}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex-1 border-t border-[color:var(--app-border)] pt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Nombre legal
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">
                              {company.businessName}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Equipo asignado
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">
                              {company.teamName}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Estado formal
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">
                              {getRegistrationStatusLabel(company.formalRegistration.registrationStatus)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Trámites abiertos
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--app-fg)]">
                              {company.pendingRequestsCount > 0 ? `${company.pendingRequestsCount} pendiente(s)` : 'Sin pendientes'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => handleOpenCompanyDetail(company.id)}
                          className={neutralActionButtonClass}
                        >
                          Detalle
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(company)}
                          className={neutralActionButtonClass}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(company)}
                          className={negativeActionButtonClass}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </AppShell>

      {isCreateModalOpen ? (
        <ModalShell
          title="Crear empresa"
          description="Registra la información base de una empresa simulada y asígnala a un equipo disponible."
          onClose={handleCloseCreateModal}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseCreateModal}
                disabled={isSaving}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="createCompanyForm"
                disabled={isSaving}
                className={positiveActionButtonClass}
              >
                {isSaving ? 'Guardando...' : 'Crear empresa'}
              </button>
            </div>
          }
        >
          <form
            id="createCompanyForm"
            className="grid min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.2fr)_360px]"
            onSubmit={handleCreateCompany}
          >
            <div className="min-h-0 px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-5">
                <div>
                  <label
                    htmlFor="teamId"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Equipo
                  </label>
                  <select
                    id="teamId"
                    value={selectedTeamId}
                    onChange={(event) => setSelectedTeamId(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="">Selecciona un equipo</option>
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="businessName"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre legal
                  </label>
                  <input
                    id="businessName"
                    type="text"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tradeName"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre comercial
                  </label>
                  <input
                    id="tradeName"
                    type="text"
                    value={tradeName}
                    onChange={(event) => setTradeName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="legalId"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Cédula jurídica simulada
                  </label>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                    <input
                      id="legalId"
                      type="text"
                      value={legalId}
                      onChange={(event) => setLegalId(event.target.value)}
                      placeholder="3-101-123456"
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                    />

                    <button
                      type="button"
                      onClick={handleGenerateLegalId}
                      className={`${neutralActionButtonClass} h-[50px] w-full`}
                    >
                      Generar cédula
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Se genera con formato costarricense simulado estilo S.A.:
                    3-101-######.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="industry"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Industria
                  </label>
                  <input
                    id="industry"
                    type="text"
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="status"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Estado
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as CompanyStatus)
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="draft">Borrador</option>
                    <option value="registered">Inscrita</option>
                  </select>
                </div>
              </div>
            </div>

            <aside className="border-t border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-5 py-5 xl:border-l xl:border-t-0 xl:px-6 xl:py-6">
              <div>
                <p className="text-sm font-medium text-[var(--app-fg)]">
                  Resumen de empresa
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Vista previa del registro actual.
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Equipo
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {selectedTeam?.name ?? 'Sin seleccionar'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nombre comercial
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {tradeName.trim() || 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cédula jurídica
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {legalId.trim() || 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estado
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getCompanyStatusLabel(status)}
                  </p>
                </div>
              </div>
            </aside>
          </form>
        </ModalShell>
      ) : null}

      {selectedCompany ? (
        <ModalShell
          title="Editar empresa"
          description="Ajusta la información base de la empresa seleccionada."
          onClose={handleCloseEditModal}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isUpdating}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="editCompanyForm"
                disabled={isUpdating}
                className={positiveActionButtonClass}
              >
                {isUpdating ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          }
        >
          <form
            id="editCompanyForm"
            className="grid min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1.2fr)_360px]"
            onSubmit={handleUpdateCompany}
          >
            <div className="min-h-0 px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-5">
                <div>
                  <label
                    htmlFor="editTeamId"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Equipo
                  </label>
                  <select
                    id="editTeamId"
                    value={editSelectedTeamId}
                    onChange={(event) => setEditSelectedTeamId(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="">Selecciona un equipo</option>
                    {editableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="editBusinessName"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre legal
                  </label>
                  <input
                    id="editBusinessName"
                    type="text"
                    value={editBusinessName}
                    onChange={(event) => setEditBusinessName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editTradeName"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre comercial
                  </label>
                  <input
                    id="editTradeName"
                    type="text"
                    value={editTradeName}
                    onChange={(event) => setEditTradeName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editLegalId"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Cédula jurídica simulada
                  </label>

                  <input
                    id="editLegalId"
                    type="text"
                    value={editLegalId}
                    disabled
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] opacity-70 outline-none transition disabled:cursor-not-allowed"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    La cédula jurídica queda fija después de crear la empresa.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="editIndustry"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Industria
                  </label>
                  <input
                    id="editIndustry"
                    type="text"
                    value={editIndustry}
                    onChange={(event) => setEditIndustry(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editStatus"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Estado
                  </label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value as CompanyStatus)
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="draft">Borrador</option>
                    <option value="registered">Inscrita</option>
                  </select>
                </div>
              </div>
            </div>

            <aside className="border-t border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-5 py-5 xl:border-l xl:border-t-0 xl:px-6 xl:py-6">
              <div>
                <p className="text-sm font-medium text-[var(--app-fg)]">
                  Resumen de empresa
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Vista previa del registro actual.
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Equipo
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {editSelectedTeam?.name ?? 'Sin seleccionar'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nombre comercial
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {editTradeName.trim() || 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cédula jurídica
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {editLegalId.trim() || 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estado
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getCompanyStatusLabel(editStatus)}
                  </p>
                </div>
              </div>
            </aside>
          </form>
        </ModalShell>
      ) : null}

      {companyToDelete ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <header>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                Eliminar empresa
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Esta acción eliminará la empresa{' '}
                <span className="font-medium text-[var(--app-fg)]">
                  {companyToDelete.tradeName}
                </span>
                .
              </p>
            </header>

            <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm font-medium text-[var(--app-fg)]">
                Equipo vinculado
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {companyToDelete.teamName}
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={isDeleting}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className={negativeActionButtonClass}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar empresa'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closeTarget ? (
        <ConfirmDiscardModal
          title="Cerrar formulario sin guardar"
          description="Tienes información sin guardar. Si cierras el modal, los cambios se perderán."
          onCancel={() => setCloseTarget(null)}
          onConfirm={handleConfirmDiscardChanges}
        />
      ) : null}
    </>
  );
}
