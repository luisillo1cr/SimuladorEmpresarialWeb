
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../utils/toast';
import { neutralActionButtonClass, positiveActionButtonClass } from '../utils/buttonStyles';

type CompanyDetailPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type FormalRegistrationStatus = 'pending' | 'in_review' | 'registered';
type TaxRegistrationStatus = 'pending' | 'active';
type MunicipalPatentStatus = 'pending' | 'active' | 'not_required';
type SocietyType = 'sa' | 'srl';
type ComplianceRequestType = 'tax_registration' | 'municipal_patent';
type ComplianceDecisionStatus = 'pending' | 'approved' | 'rejected' | 'not_required';
type StudentJobTitle = 'unassigned' | 'general_manager' | 'finance' | 'sales' | 'operations' | 'hr';
type StudentOption = { uid: string; fullName: string; jobTitle: StudentJobTitle };

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

type ComplianceRequestRecord = {
  id: string;
  companyId: string;
  type: ComplianceRequestType;
  status: ComplianceDecisionStatus;
  reviewerComment: string;
  submittedAt: unknown;
};

function getRegistrationStatusLabel(status: FormalRegistrationStatus) {
  switch (status) {
    case 'registered': return 'Inscrita';
    case 'in_review': return 'En revisión';
    case 'pending':
    default: return 'Pendiente';
  }
}
function getTaxStatusLabel(status: TaxRegistrationStatus) {
  return status === 'active' ? 'Activa' : 'Pendiente';
}
function getPatentStatusLabel(status: MunicipalPatentStatus) {
  switch (status) {
    case 'active': return 'Activa';
    case 'not_required': return 'No requerida';
    default: return 'Pendiente';
  }
}
function getSocietyTypeLabel(type: SocietyType) {
  return type === 'srl' ? 'Sociedad de Responsabilidad Limitada' : 'Sociedad Anónima';
}
function getRequestTypeLabel(type: ComplianceRequestType) {
  return type === 'municipal_patent' ? 'Patente municipal' : 'Inscripción tributaria';
}
function getRequestStatusLabel(status: ComplianceDecisionStatus) {
  switch (status) {
    case 'approved': return 'Aprobada';
    case 'rejected': return 'Rechazada';
    case 'not_required': return 'No requerida';
    default: return 'Pendiente';
  }
}

function isValidStudentJobTitle(value: unknown): value is StudentJobTitle {
  return value === 'unassigned' || value === 'general_manager' || value === 'finance' || value === 'sales' || value === 'operations' || value === 'hr';
}

function getStudentJobTitleLabel(jobTitle: StudentJobTitle) {
  switch (jobTitle) {
    case 'general_manager': return 'Gerencia';
    case 'finance': return 'Finanzas';
    case 'sales': return 'Ventas';
    case 'operations': return 'Operaciones';
    case 'hr': return 'Recursos Humanos';
    case 'unassigned':
    default: return 'Sin asignar';
  }
}

function getStudentJobTitleBadgeClass(jobTitle: StudentJobTitle) {
  switch (jobTitle) {
    case 'general_manager': return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300';
    case 'finance': return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
    case 'sales': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'operations': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
    case 'hr': return 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900/40 dark:bg-pink-950/40 dark:text-pink-300';
    case 'unassigned':
    default: return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function CompanyDetailPage({ isDarkMode, onToggleTheme }: CompanyDetailPageProps) {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const { profile, signOutUser } = useAuth();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [teamStudents, setTeamStudents] = useState<StudentOption[]>([]);
  const [requests, setRequests] = useState<ComplianceRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingJobTitleUid, setSavingJobTitleUid] = useState<string | null>(null);

  const [societyType, setSocietyType] = useState<SocietyType>('sa');
  const [legalRepresentative, setLegalRepresentative] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<FormalRegistrationStatus>('pending');
  const [taxRegistrationStatus, setTaxRegistrationStatus] = useState<TaxRegistrationStatus>('pending');
  const [municipalPatentStatus, setMunicipalPatentStatus] = useState<MunicipalPatentStatus>('pending');
  const [notes, setNotes] = useState('');

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };
  const handleOpenProfile = () => navigate('/profile');

  const loadCompany = async () => {
    if (!companyId) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const snapshot = await getDoc(doc(db, 'companies', companyId));
      if (!snapshot.exists()) {
        toast.error('Empresa no encontrada', 'No existe una empresa con ese identificador.');
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
          societyType: data.formalRegistration?.societyType === 'srl' ? 'srl' : 'sa',
          legalRepresentative: data.formalRegistration?.legalRepresentative ?? '',
          registrationStatus: data.formalRegistration?.registrationStatus === 'registered' ? 'registered' : data.formalRegistration?.registrationStatus === 'in_review' ? 'in_review' : 'pending',
          taxRegistrationStatus: data.formalRegistration?.taxRegistrationStatus === 'active' ? 'active' : 'pending',
          municipalPatentStatus: data.formalRegistration?.municipalPatentStatus === 'active' ? 'active' : data.formalRegistration?.municipalPatentStatus === 'not_required' ? 'not_required' : 'pending',
          notes: data.formalRegistration?.notes ?? '',
        },
      };
      setCompany(nextCompany);
      setSocietyType(nextCompany.formalRegistration.societyType);
      setLegalRepresentative(nextCompany.formalRegistration.legalRepresentative);
      setRegistrationStatus(nextCompany.formalRegistration.registrationStatus);
      setTaxRegistrationStatus(nextCompany.formalRegistration.taxRegistrationStatus);
      setMunicipalPatentStatus(nextCompany.formalRegistration.municipalPatentStatus);
      setNotes(nextCompany.formalRegistration.notes);
    } catch {
      toast.error('No se pudo cargar la empresa', 'Revisa las reglas de Firestore y vuelve a intentarlo.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamStudents = async (teamId: string) => {
    if (!teamId) {
      setTeamStudents([]);
      return;
    }

    try {
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('teamId', '==', teamId))
      );

      const nextStudents = usersSnapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            uid: document.id,
            role: String(data.role ?? ''),
            status: String(data.status ?? 'active'),
            fullName: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
            jobTitle: isValidStudentJobTitle(data.jobTitle) ? data.jobTitle : 'unassigned',
          };
        })
        .filter(
          (student) => student.role === 'student' && student.status !== 'inactive'
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
        .map(({ uid, fullName, jobTitle }) => ({ uid, fullName, jobTitle }));

      setTeamStudents(nextStudents);
    } catch (error) {
      console.error('Error cargando estudiantes del equipo:', error);
      setTeamStudents([]);
      toast.error(
        'No se pudieron cargar los estudiantes del equipo',
        'Verifica la colección users y vuelve a intentarlo.'
      );
    }
  };

  const loadRequests = async (currentCompanyId: string) => {
    try {
      const requestsSnapshot = await getDocs(
        query(collection(db, 'companyComplianceRequests'), where('companyId', '==', currentCompanyId))
      );
      const nextRequests: ComplianceRequestRecord[] = requestsSnapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            id: document.id,
            companyId: String(data.companyId ?? ''),
            type: data.type === 'municipal_patent' ? 'municipal_patent' : 'tax_registration',
            status: data.status === 'approved' ? 'approved' : data.status === 'rejected' ? 'rejected' : data.status === 'not_required' ? 'not_required' : 'pending',
            reviewerComment: String(data.reviewerComment ?? ''),
            submittedAt: data.submittedAt ?? null,
          };
        })
        .sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0));
      setRequests(nextRequests);
    } catch (error) {
      console.error('Error cargando solicitudes regulatorias:', error);
      setRequests([]);
    }
  };

  useEffect(() => { void loadCompany(); }, [companyId]);
  useEffect(() => {
    if (!company) return;
    void loadTeamStudents(company.teamId);
    void loadRequests(company.id);
  }, [company?.teamId, company?.id]);

  const handleSaveFormalRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'companies', company.id), {
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
      toast.success('Detalle actualizado', 'La inscripción formal simplificada fue guardada correctamente.');
      setCompany((current) => current ? { ...current, formalRegistration: { societyType, legalRepresentative: legalRepresentative.trim(), registrationStatus, taxRegistrationStatus, municipalPatentStatus, notes: notes.trim() } } : current);
    } catch {
      toast.error('No se pudo guardar el detalle', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleJobTitleChange = (studentUid: string, nextJobTitle: StudentJobTitle) => {
    setTeamStudents((currentStudents) =>
      currentStudents.map((student) =>
        student.uid === studentUid ? { ...student, jobTitle: nextJobTitle } : student
      )
    );
  };

  const handleSaveStudentJobTitle = async (studentUid: string) => {
    const targetStudent = teamStudents.find((student) => student.uid === studentUid);

    if (!targetStudent) {
      return;
    }

    try {
      setSavingJobTitleUid(studentUid);
      await updateDoc(doc(db, 'users', studentUid), {
        jobTitle: targetStudent.jobTitle,
        updatedAt: serverTimestamp(),
      });

      toast.success('Puesto actualizado', 'El puesto del estudiante quedó vinculado desde la empresa.');
    } catch (error) {
      console.error('Error guardando puesto del estudiante:', error);
      toast.error('No se pudo actualizar el puesto', 'Verifica los permisos del usuario y vuelve a intentarlo.');
    } finally {
      setSavingJobTitleUid(null);
    }
  };

  return (
    <AppShell
      title="Detalle de empresa"
      subtitle="Resumen operativo, inscripción formal simplificada e historial regulatorio." 
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      {isLoading ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Cargando detalle de empresa...</div>
        </section>
      ) : !company ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">No se encontró la empresa solicitada.</div>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">{company.tradeName}</h2>
                  <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">{company.teamName}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Empresa simulada activa para el equipo asignado, con información base e inscripción formal simplificada.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => navigate(`/company-operations/${company.id}`)} className={positiveActionButtonClass}>Operación mensual</button>
                <button type="button" onClick={() => navigate('/admin/companies')} className={neutralActionButtonClass}>Volver a empresas</button>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Información base</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Datos principales de la empresa simulada.</p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Nombre legal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.businessName}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Nombre comercial</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.tradeName}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Cédula jurídica</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.legalId}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Industria</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.industry}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 sm:col-span-2"><p className="text-xs text-slate-500 dark:text-slate-400">Equipo asignado</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{company.teamName}</p></div>
              </div>
            </section>
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5"><h3 className="text-lg font-semibold">Resumen formal</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Estado actual simplificado de la empresa.</p></header>
              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Tipo societario</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getSocietyTypeLabel(societyType)}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Representante legal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{legalRepresentative.trim() || 'Sin definir'}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Tributación</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getTaxStatusLabel(taxRegistrationStatus)}</p></div>
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Patente municipal</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getPatentStatusLabel(municipalPatentStatus)}</p></div>
              </div>
            </section>
          </div>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5"><h3 className="text-lg font-semibold">Inscripción formal simplificada</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Simulación básica del proceso formal de constitución y registro.</p></header>
            <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={handleSaveFormalRegistration}>
              <div className="grid gap-5">
                <div>
                  <label htmlFor="societyType" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo societario</label>
                  <select id="societyType" value={societyType} onChange={(event) => setSocietyType(event.target.value as SocietyType)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="sa">Sociedad Anónima</option>
                    <option value="srl">Sociedad de Responsabilidad Limitada</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="legalRepresentative" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Representante legal</label>
                  <select id="legalRepresentative" value={legalRepresentative} onChange={(event) => setLegalRepresentative(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="">Selecciona un integrante del equipo</option>
                    {teamStudents.map((student) => <option key={student.uid} value={student.fullName}>{student.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="registrationStatus" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Estado de inscripción</label>
                  <select id="registrationStatus" value={registrationStatus} onChange={(event) => setRegistrationStatus(event.target.value as FormalRegistrationStatus)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="pending">Pendiente</option><option value="in_review">En revisión</option><option value="registered">Inscrita</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="taxRegistrationStatus" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Inscripción tributaria</label>
                  <select id="taxRegistrationStatus" value={taxRegistrationStatus} onChange={(event) => setTaxRegistrationStatus(event.target.value as TaxRegistrationStatus)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="pending">Pendiente</option><option value="active">Activa</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="municipalPatentStatus" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Patente municipal</label>
                  <select id="municipalPatentStatus" value={municipalPatentStatus} onChange={(event) => setMunicipalPatentStatus(event.target.value as MunicipalPatentStatus)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="pending">Pendiente</option><option value="active">Activa</option><option value="not_required">No requerida</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Observaciones</label>
                  <textarea id="notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition" />
                </div>
              </div>
              <aside className="flex flex-col rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <div><p className="text-sm font-medium text-[var(--app-fg)]">Vista rápida</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Estado resumido de la simulación formal.</p></div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Tipo societario</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getSocietyTypeLabel(societyType)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Inscripción</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getRegistrationStatusLabel(registrationStatus)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Tributación</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getTaxStatusLabel(taxRegistrationStatus)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Patente</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{getPatentStatusLabel(municipalPatentStatus)}</p></div>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <button type="submit" disabled={isSaving} className={positiveActionButtonClass}>{isSaving ? 'Guardando...' : 'Guardar inscripción'}</button>
                </div>
              </aside>
            </form>
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5">
              <h3 className="text-lg font-semibold">Puestos del equipo</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                El puesto del estudiante se administra aquí para que quede ligado al contexto real de la empresa y del equipo.
              </p>
            </header>

            {teamStudents.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
                Todavía no hay estudiantes activos asignados a este equipo.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {teamStudents.map((student) => (
                  <article key={student.uid} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-[var(--app-fg)]">{student.fullName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={[
                            'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                            getStudentJobTitleBadgeClass(student.jobTitle),
                          ].join(' ')}>{getStudentJobTitleLabel(student.jobTitle)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSaveStudentJobTitle(student.uid)}
                        disabled={savingJobTitleUid === student.uid}
                        className={positiveActionButtonClass}
                      >
                        {savingJobTitleUid === student.uid ? 'Guardando...' : 'Guardar puesto'}
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Puesto de trabajo
                      </label>
                      <select
                        value={student.jobTitle}
                        onChange={(event) => handleJobTitleChange(student.uid, event.target.value as StudentJobTitle)}
                        className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                      >
                        <option value="unassigned">Sin asignar</option>
                        <option value="general_manager">Gerencia</option>
                        <option value="finance">Finanzas</option>
                        <option value="sales">Ventas</option>
                        <option value="operations">Operaciones</option>
                        <option value="hr">Recursos Humanos</option>
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5">
              <h3 className="text-lg font-semibold">Historial regulatorio</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">El equipo gestiona las solicitudes desde Mi empresa. Aquí solo se refleja el historial y el estado final sincronizado.</p>
            </header>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <p className="text-sm font-medium text-[var(--app-fg)]">Criterio del módulo</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>Las solicitudes regulatorias se envían desde la vista del estudiante en <strong>Mi empresa</strong>.</p>
                  <p>Desde el panel docente lo correcto es revisar, aprobar, rechazar o marcar la patente como no requerida.</p>
                  <p>Cuando una solicitud se resuelve, el estado formal de esta empresa debe reflejarse automáticamente arriba.</p>
                </div>
              </div>
              <aside className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--app-fg)]">Historial reciente</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{requests.length} registro(s)</span>
                </div>
                <div className="mt-4 max-h-[380px] space-y-3 overflow-y-auto pr-1">
                  {requests.length > 0 ? requests.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                      <p className="text-sm font-medium text-[var(--app-fg)]">{getRequestTypeLabel(request.type)}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getRequestStatusLabel(request.status)}</p>
                      {request.reviewerComment ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{request.reviewerComment}</p> : null}
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-sm text-slate-500 dark:text-slate-400">Todavía no hay solicitudes enviadas.</div>}
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
