import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../utils/toast';
import {
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';

type CompanyDetailPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type FormalRegistrationStatus = 'pending' | 'in_review' | 'registered';
type TaxRegistrationStatus = 'pending' | 'active';
type MunicipalPatentStatus = 'pending' | 'active' | 'not_required';
type SocietyType = 'sa' | 'srl';

type CompanyDetail = {
  id: string;
  teamId: string;
  teamName: string;
  businessName: string;
  tradeName: string;
  legalId: string;
  industry: string;
  status: 'draft' | 'registered';
  formalRegistration: {
    societyType: SocietyType;
    legalRepresentative: string;
    registrationStatus: FormalRegistrationStatus;
    taxRegistrationStatus: TaxRegistrationStatus;
    municipalPatentStatus: MunicipalPatentStatus;
    notes: string;
  };
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

function getSocietyTypeLabel(type: SocietyType) {
  switch (type) {
    case 'srl':
      return 'Sociedad de Responsabilidad Limitada';
    case 'sa':
    default:
      return 'Sociedad Anónima';
  }
}

export function CompanyDetailPage({
  isDarkMode,
  onToggleTheme,
}: CompanyDetailPageProps) {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const { signOutUser } = useAuth();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [societyType, setSocietyType] = useState<SocietyType>('sa');
  const [legalRepresentative, setLegalRepresentative] = useState('');
  const [registrationStatus, setRegistrationStatus] =
    useState<FormalRegistrationStatus>('pending');
  const [taxRegistrationStatus, setTaxRegistrationStatus] =
    useState<TaxRegistrationStatus>('pending');
  const [municipalPatentStatus, setMunicipalPatentStatus] =
    useState<MunicipalPatentStatus>('pending');
  const [notes, setNotes] = useState('');

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  useEffect(() => {
    const loadCompany = async () => {
      if (!companyId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const companyRef = doc(db, 'companies', companyId);
        const snapshot = await getDoc(companyRef);

        if (!snapshot.exists()) {
          toast.error(
            'Empresa no encontrada',
            'No existe una empresa con ese identificador.'
          );
          setCompany(null);
          return;
        }

        const data = snapshot.data();

        const nextCompany: CompanyDetail = {
          id: snapshot.id,
          teamId: data.teamId ?? '',
          teamName: data.teamName ?? '',
          businessName: data.businessName ?? '',
          tradeName: data.tradeName ?? '',
          legalId: data.legalId ?? '',
          industry: data.industry ?? '',
          status: data.status === 'registered' ? 'registered' : 'draft',
          formalRegistration: {
            societyType:
              data.formalRegistration?.societyType === 'srl' ? 'srl' : 'sa',
            legalRepresentative:
              data.formalRegistration?.legalRepresentative ?? '',
            registrationStatus:
              data.formalRegistration?.registrationStatus === 'registered'
                ? 'registered'
                : data.formalRegistration?.registrationStatus === 'in_review'
                  ? 'in_review'
                  : 'pending',
            taxRegistrationStatus:
              data.formalRegistration?.taxRegistrationStatus === 'active'
                ? 'active'
                : 'pending',
            municipalPatentStatus:
              data.formalRegistration?.municipalPatentStatus === 'active'
                ? 'active'
                : data.formalRegistration?.municipalPatentStatus ===
                    'not_required'
                  ? 'not_required'
                  : 'pending',
            notes: data.formalRegistration?.notes ?? '',
          },
        };

        setCompany(nextCompany);
        setSocietyType(nextCompany.formalRegistration.societyType);
        setLegalRepresentative(
          nextCompany.formalRegistration.legalRepresentative
        );
        setRegistrationStatus(
          nextCompany.formalRegistration.registrationStatus
        );
        setTaxRegistrationStatus(
          nextCompany.formalRegistration.taxRegistrationStatus
        );
        setMunicipalPatentStatus(
          nextCompany.formalRegistration.municipalPatentStatus
        );
        setNotes(nextCompany.formalRegistration.notes);
      } catch {
        toast.error(
          'No se pudo cargar la empresa',
          'Revisa las reglas de Firestore y vuelve a intentarlo.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadCompany();
  }, [companyId]);

  const handleSaveFormalRegistration = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!company) {
      return;
    }

    try {
      setIsSaving(true);

      const companyRef = doc(db, 'companies', company.id);

      await updateDoc(companyRef, {
        formalRegistration: {
          societyType,
          legalRepresentative: legalRepresentative.trim(),
          registrationStatus,
          taxRegistrationStatus,
          municipalPatentStatus,
          notes: notes.trim(),
        },
        updatedAt: serverTimestamp(),
      });

      toast.success(
        'Detalle actualizado',
        'La inscripción formal simplificada fue guardada correctamente.'
      );

      setCompany((current) =>
        current
          ? {
              ...current,
              formalRegistration: {
                societyType,
                legalRepresentative: legalRepresentative.trim(),
                registrationStatus,
                taxRegistrationStatus,
                municipalPatentStatus,
                notes: notes.trim(),
              },
            }
          : current
      );
    } catch {
      toast.error(
        'No se pudo guardar el detalle',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Detalle de empresa"
      subtitle="Resumen operativo e inscripción formal simplificada."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      {isLoading ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Cargando detalle de empresa...
          </div>
        </section>
      ) : !company ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            No se encontró la empresa solicitada.
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
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
                  Empresa simulada activa para el equipo asignado, con
                  información base e inscripción formal simplificada.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate(`/company-operations/${company.id}`)}
                  className={positiveActionButtonClass}
                >
                  Operación mensual
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/companies')}
                  className={neutralActionButtonClass}
                >
                  Volver a empresas
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Información base</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Datos principales de la empresa simulada.
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

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 sm:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Equipo asignado
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {company.teamName}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Resumen formal</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Estado actual simplificado de la empresa.
                </p>
              </header>

              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tipo societario
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getSocietyTypeLabel(societyType)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Representante legal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {legalRepresentative.trim() || 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tributación
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getTaxStatusLabel(taxRegistrationStatus)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Patente municipal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {getPatentStatusLabel(municipalPatentStatus)}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5">
              <h3 className="text-lg font-semibold">
                Inscripción formal simplificada
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Simulación básica del proceso formal de constitución y registro.
              </p>
            </header>

            <form
              className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
              onSubmit={handleSaveFormalRegistration}
            >
              <div className="grid gap-5">
                <div>
                  <label
                    htmlFor="societyType"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Tipo societario
                  </label>
                  <select
                    id="societyType"
                    value={societyType}
                    onChange={(event) =>
                      setSocietyType(event.target.value as SocietyType)
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="sa">Sociedad Anónima</option>
                    <option value="srl">
                      Sociedad de Responsabilidad Limitada
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="legalRepresentative"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Representante legal
                  </label>
                  <input
                    id="legalRepresentative"
                    type="text"
                    value={legalRepresentative}
                    onChange={(event) =>
                      setLegalRepresentative(event.target.value)
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="registrationStatus"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Estado de inscripción
                  </label>
                  <select
                    id="registrationStatus"
                    value={registrationStatus}
                    onChange={(event) =>
                      setRegistrationStatus(
                        event.target.value as FormalRegistrationStatus
                      )
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_review">En revisión</option>
                    <option value="registered">Inscrita</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="taxRegistrationStatus"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Inscripción tributaria
                  </label>
                  <select
                    id="taxRegistrationStatus"
                    value={taxRegistrationStatus}
                    onChange={(event) =>
                      setTaxRegistrationStatus(
                        event.target.value as TaxRegistrationStatus
                      )
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="active">Activa</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="municipalPatentStatus"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Patente municipal
                  </label>
                  <select
                    id="municipalPatentStatus"
                    value={municipalPatentStatus}
                    onChange={(event) =>
                      setMunicipalPatentStatus(
                        event.target.value as MunicipalPatentStatus
                      )
                    }
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="active">Activa</option>
                    <option value="not_required">No requerida</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Observaciones
                  </label>
                  <textarea
                    id="notes"
                    rows={5}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>
              </div>

              <aside className="flex flex-col rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <div>
                  <p className="text-sm font-medium text-[var(--app-fg)]">
                    Vista rápida
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Estado resumido de la simulación formal.
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tipo societario
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                      {getSocietyTypeLabel(societyType)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Inscripción
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                      {getRegistrationStatusLabel(registrationStatus)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tributación
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                      {getTaxStatusLabel(taxRegistrationStatus)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Patente
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                      {getPatentStatusLabel(municipalPatentStatus)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={positiveActionButtonClass}
                  >
                    {isSaving ? 'Guardando...' : 'Guardar detalle'}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/admin/companies')}
                    className={neutralActionButtonClass}
                  >
                    Volver a empresas
                  </button>
                </div>
              </aside>
            </form>
          </section>
        </div>
      )}
    </AppShell>
  );
}