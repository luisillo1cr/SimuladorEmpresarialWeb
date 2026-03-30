import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { getRoleLabel, getStatusLabel } from '../utils/authLabels';
import { toast } from '../utils/toast';
import {
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';

type ProfilePageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type CompanyRecord = {
  id: string;
  tradeName: string;
  businessName: string;
  teamName: string;
};

type OperationRecord = {
  id: string;
  periodLabel: string;
  netResult: number;
  status: 'draft' | 'closed';
  periodYear: number;
  periodMonth: number;
};

type PayrollRunRecord = {
  id: string;
  period: string;
  grossTotal: number;
  employeeCount: number;
};


type OperationWithCompanyRecord = OperationRecord & {
  companyId: string;
};

type PayrollRunWithCompanyRecord = PayrollRunRecord & {
  companyId: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function getInitials(firstName?: string, lastName?: string) {
  const a = firstName?.[0] ?? '';
  const b = lastName?.[0] ?? '';
  return `${a}${b}`.trim() || 'U';
}

export function ProfilePage({
  isDarkMode,
  onToggleTheme,
}: ProfilePageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [teamLabel, setTeamLabel] = useState<string>('Sin asignar');
  const [latestOperation, setLatestOperation] = useState<OperationRecord | null>(null);
  const [latestPayroll, setLatestPayroll] = useState<PayrollRunRecord | null>(null);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  useEffect(() => {
    const loadStudentContext = async () => {
      if (!profile || profile.role !== 'student' || !profile.teamId) {
        setCompany(null);
        setLatestOperation(null);
        setLatestPayroll(null);
        return;
      }

      setIsLoadingExtras(true);

      try {
        try {
          const teamSnapshot = await getDoc(doc(db, 'teams', profile.teamId));
          if (teamSnapshot.exists()) {
            const teamData = teamSnapshot.data();
            const nextTeamLabel = String(teamData.name ?? teamData.teamName ?? '').trim();
            setTeamLabel(nextTeamLabel || 'Equipo asignado');
          } else {
            setTeamLabel('Equipo asignado');
          }
        } catch {
          setTeamLabel('Equipo asignado');
        }

        const companySnapshot = await getDocs(
          query(collection(db, 'companies'), where('teamId', '==', profile.teamId))
        );

        const companyDoc = companySnapshot.docs[0] ?? null;
        if (!companyDoc) {
          setCompany(null);
          setLatestOperation(null);
          setLatestPayroll(null);
          return;
        }

        const companyData = companyDoc.data();
        const nextCompany: CompanyRecord = {
          id: companyDoc.id,
          tradeName: String(companyData.tradeName ?? ''),
          businessName: String(companyData.businessName ?? ''),
          teamName: String(companyData.teamName ?? ''),
        };
        setCompany(nextCompany);
        if (nextCompany.teamName.trim()) {
          setTeamLabel(nextCompany.teamName.trim());
        }

        try {
          const operationsSnapshot = await getDocs(
            query(collection(db, 'monthlyOperations'), where('teamId', '==', profile.teamId))
          );

          const latest = operationsSnapshot.docs
            .map((document): OperationWithCompanyRecord => {
              const data = document.data();
              const status: OperationRecord['status'] =
                data.status === 'closed' ? 'closed' : 'draft';

              return {
                id: document.id,
                periodLabel: String(data.periodLabel ?? ''),
                netResult: Number(data.netResult ?? 0),
                status,
                periodYear: Number(data.periodYear ?? 0),
                periodMonth: Number(data.periodMonth ?? 0),
                companyId: String(data.companyId ?? ''),
              };
            })
            .filter((item) => item.companyId === nextCompany.id)
            .sort((a, b) =>
              a.periodYear !== b.periodYear
                ? b.periodYear - a.periodYear
                : b.periodMonth - a.periodMonth
            )[0] ?? null;

          setLatestOperation(
            latest
              ? {
                  id: latest.id,
                  periodLabel: latest.periodLabel,
                  netResult: latest.netResult,
                  status: latest.status,
                  periodYear: latest.periodYear,
                  periodMonth: latest.periodMonth,
                }
              : null
          );
        } catch {
          setLatestOperation(null);
        }

        try {
          const payrollSnapshot = await getDocs(
            query(collection(db, 'payrollRuns'), where('teamId', '==', profile.teamId))
          );

          const latestRun = payrollSnapshot.docs
            .map((document): PayrollRunWithCompanyRecord => {
              const data = document.data();
              return {
                id: document.id,
                period: String(data.period ?? ''),
                grossTotal: Number(data.grossTotal ?? 0),
                employeeCount: Number(data.employeeCount ?? 0),
                companyId: String(data.companyId ?? ''),
              };
            })
            .filter((item) => item.companyId === nextCompany.id)
            .sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;

          setLatestPayroll(latestRun);
        } catch {
          setLatestPayroll(null);
        }
      } catch {
        toast.warning(
          'No se pudieron cargar algunos datos del perfil',
          'Se mostrará la información disponible.'
        );
      } finally {
        setIsLoadingExtras(false);
      }
    };

    void loadStudentContext();
  }, [profile]);

  const quickActions = useMemo(() => {
    if (profile?.role === 'student') {
      return [
        {
          label: 'Ir a mi empresa',
          onClick: () => navigate('/my-company'),
          className: positiveActionButtonClass,
        },
        {
          label: 'Abrir operación mensual',
          onClick: () => {
            if (company?.id) {
              navigate(`/company-operations/${company.id}`);
              return;
            }
            navigate('/my-company');
          },
          className: neutralActionButtonClass,
        },
      ];
    }

    return [
      {
        label: 'Ir al dashboard',
        onClick: () => navigate('/dashboard'),
        className: positiveActionButtonClass,
      },
      {
        label: 'Ver usuarios',
        onClick: () => navigate('/admin/users'),
        className: neutralActionButtonClass,
      },
    ];
  }, [company?.id, navigate, profile?.role]);

  return (
    <AppShell
      title="Perfil"
      subtitle="Información general de tu cuenta, contexto actual y accesos rápidos."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-3xl font-semibold text-[var(--app-fg)]">
              {getInitials(profile?.firstName, profile?.lastName)}
            </div>

            <h2 className="mt-4 text-xl font-semibold">
              {profile?.firstName} {profile?.lastName}
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {profile?.email}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {getRoleLabel(profile?.role)}
              </span>
              <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {getStatusLabel(profile?.status)}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`${action.className} w-full`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <header className="mb-6">
            <h2 className="text-lg font-semibold">Información del usuario</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Resumen general de la cuenta y del contexto actual de trabajo.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nombre
              </p>
              <p className="mt-2 text-base font-medium">
                {profile?.firstName} {profile?.lastName}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Correo electrónico
              </p>
              <p className="mt-2 text-base font-medium">{profile?.email}</p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Rol</p>
              <p className="mt-2 text-base font-medium">
                {getRoleLabel(profile?.role)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estado
              </p>
              <p className="mt-2 text-base font-medium">
                {getStatusLabel(profile?.status)}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Equipo asignado
              </p>
              <p className="mt-2 text-base font-medium">
                {teamLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Empresa asignada
              </p>
              <p className="mt-2 text-base font-medium">
                {company?.tradeName ?? 'Sin empresa asignada'}
              </p>
            </div>
          </div>

          {profile?.role === 'student' ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nombre legal
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--app-fg)]">
                  {company?.businessName ?? 'Pendiente'}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {company?.teamName ?? 'Sin equipo confirmado'}
                </p>
              </div>

              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Última operación
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--app-fg)]">
                  {latestOperation?.periodLabel ?? 'Sin datos'}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {latestOperation
                    ? `Resultado: ${formatCurrency(latestOperation.netResult)} · ${latestOperation.status === 'closed' ? 'Cerrada' : 'Borrador'}`
                    : 'Aún no hay operación registrada'}
                </p>
              </div>

              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Última planilla
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--app-fg)]">
                  {latestPayroll?.period ?? 'Sin datos'}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {latestPayroll
                    ? `${latestPayroll.employeeCount} empleado(s) · ${formatCurrency(latestPayroll.grossTotal)}`
                    : 'Aún no hay planilla generada'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5 text-sm text-slate-600 dark:text-slate-400">
              Este perfil puede seguir creciendo más adelante con preferencias, auditoría y configuración avanzada.
            </div>
          )}

          {isLoadingExtras ? (
            <div className="mt-6 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4 text-sm text-slate-600 dark:text-slate-400">
              Cargando contexto adicional del perfil...
            </div>
          ) : null}
        </article>
      </div>
    </AppShell>
  );
}