import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
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
  switch (status) {
    case 'active':
      return 'Activa';
    case 'pending':
    default:
      return 'Pendiente';
  }
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2,
  }).format(value);
}

export function MyCompanyPage({
  isDarkMode,
  onToggleTheme,
}: MyCompanyPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [operations, setOperations] = useState<MonthlyOperationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentPeriodLabel = useMemo(() => {
    const now = new Date();
    return `${now.toLocaleString('es-CR', {
      month: 'long',
    })} ${now.getFullYear()}`;
  }, []);

  const latestOperation = useMemo(() => {
    return operations[0] ?? null;
  }, [operations]);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  useEffect(() => {
    const loadMyCompany = async () => {
      if (!profile) {
        setIsLoading(false);
        return;
      }

      if (profile.role !== 'student') {
        setIsLoading(false);
        return;
      }

      if (!profile.teamId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const companiesRef = collection(db, 'companies');
        const companiesQuery = query(
          companiesRef,
          where('teamId', '==', profile.teamId)
        );
        const companiesSnapshot = await getDocs(companiesQuery);

        if (companiesSnapshot.empty) {
          setCompany(null);
          setOperations([]);
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
            societyType:
              companyData.formalRegistration?.societyType === 'srl'
                ? 'srl'
                : 'sa',
            legalRepresentative:
              companyData.formalRegistration?.legalRepresentative ?? '',
            registrationStatus:
              companyData.formalRegistration?.registrationStatus ===
              'registered'
                ? 'registered'
                : companyData.formalRegistration?.registrationStatus ===
                    'in_review'
                  ? 'in_review'
                  : 'pending',
            taxRegistrationStatus:
              companyData.formalRegistration?.taxRegistrationStatus === 'active'
                ? 'active'
                : 'pending',
            municipalPatentStatus:
              companyData.formalRegistration?.municipalPatentStatus === 'active'
                ? 'active'
                : companyData.formalRegistration?.municipalPatentStatus ===
                    'not_required'
                  ? 'not_required'
                  : 'pending',
            notes: companyData.formalRegistration?.notes ?? '',
          },
        };

        setCompany(nextCompany);

        /*
          Important:
          Query monthly operations by teamId so the query matches the
          security rules that restrict access by team ownership.
        */
        const operationsRef = collection(db, 'monthlyOperations');
        const operationsQuery = query(
          operationsRef,
          where('teamId', '==', profile.teamId)
        );
        const operationsSnapshot = await getDocs(operationsQuery);

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
          .sort((a, b) => {
            if (a.periodYear !== b.periodYear) {
              return b.periodYear - a.periodYear;
            }

            return b.periodMonth - a.periodMonth;
          });

        setOperations(nextOperations);
      } catch {
        toast.error(
          'No se pudo cargar tu empresa',
          'Revisa las reglas y vuelve a intentarlo.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadMyCompany();
  }, [profile]);

  return (
    <AppShell
      title="Mi empresa"
      subtitle="Resumen de tu empresa y acceso a la operación mensual."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      {!profile ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Cargando sesión...
          </div>
        </section>
      ) : profile.role !== 'student' ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Esta vista está disponible únicamente para estudiantes.
          </div>
        </section>
      ) : isLoading ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Cargando información de la empresa...
          </div>
        </section>
      ) : !profile.teamId ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Aún no estás asignado a un equipo. Cuando el docente te asigne uno,
            aquí podrás ver tu empresa y la operación mensual.
          </div>
        </section>
      ) : !company ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Tu equipo todavía no tiene una empresa registrada. Cuando el docente
            la cree, aquí aparecerá toda la información.
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                    {company.tradeName}
                  </h2>

                  <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {company.teamName}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Empresa asignada a tu equipo para la práctica actual.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate(`/company-operations/${company.id}`)}
                  className={positiveActionButtonClass}
                >
                  Abrir operación mensual
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/company-operations/${company.id}`)}
                  className={neutralActionButtonClass}
                >
                  Ir al período {currentPeriodLabel}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Datos de la empresa</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Información base con la que trabajará tu equipo.
                </p>
              </header>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nombre legal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.businessName}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nombre comercial
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.tradeName}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cédula jurídica
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.legalId}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Industria
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.industry}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Estado formal</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Resumen simplificado del estado actual.
                </p>
              </header>

              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Inscripción
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getRegistrationStatusLabel(
                      company.formalRegistration.registrationStatus
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tributación
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getTaxStatusLabel(
                      company.formalRegistration.taxRegistrationStatus
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Patente municipal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getPatentStatusLabel(
                      company.formalRegistration.municipalPatentStatus
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Representante legal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.formalRegistration.legalRepresentative.trim() ||
                      'Sin definir'}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5">
              <h3 className="text-lg font-semibold">Operación mensual</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Resumen de períodos operativos registrados por tu equipo.
              </p>
            </header>

            {latestOperation ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--app-fg)]">
                        Último período registrado
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {latestOperation.periodLabel}
                      </p>
                    </div>

                    <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {latestOperation.status === 'closed'
                        ? 'Cerrado'
                        : 'Borrador'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Caja inicial
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">
                        {formatCurrency(latestOperation.openingCash)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ingresos
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">
                        {formatCurrency(latestOperation.totalIncome)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Gastos
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">
                        {formatCurrency(latestOperation.totalExpenses)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Resultado
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">
                        {formatCurrency(latestOperation.netResult)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                  <p className="text-sm font-medium text-[var(--app-fg)]">
                    Acción rápida
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Continúa o actualiza la operación del período actual.
                  </p>

                  <div className="mt-5 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/company-operations/${company.id}`)
                      }
                      className={positiveActionButtonClass}
                    >
                      Abrir operación mensual
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/company-operations/${company.id}`)
                      }
                      className={neutralActionButtonClass}
                    >
                      Ver historial operativo
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
                Tu equipo todavía no ha registrado ningún período operativo.
                Puedes iniciar el primero desde el botón de operación mensual.
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}