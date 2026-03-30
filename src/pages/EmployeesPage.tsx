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
  where,
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
import { normalizePositiveNumberInput } from '../utils/numeric';

type EmployeesPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type StudentJobTitle =
  | 'unassigned'
  | 'general_manager'
  | 'finance'
  | 'sales'
  | 'operations'
  | 'hr';

type CompanyOption = {
  id: string;
  teamId: string;
  teamName: string;
  tradeName: string;
};

type LinkedStudentOption = {
  uid: string;
  fullName: string;
  jobTitle: StudentJobTitle;
};

type EmployeeStatus = 'active' | 'inactive';

type EmployeeRecord = {
  id: string;
  companyId: string;
  companyName: string;
  teamId: string;
  teamName: string;
  linkedStudentId: string | null;
  fullName: string;
  position: string;
  department: string;
  salary: number;
  status: EmployeeStatus;
};

const BASE_POSITION_OPTIONS = [
  'Gerencia',
  'Finanzas',
  'Ventas',
  'Operaciones',
  'Recursos Humanos',
];

const BASE_DEPARTMENT_OPTIONS = [
  'Dirección',
  'Finanzas',
  'Ventas',
  'Operaciones',
  'Recursos Humanos',
];

function getStatusBadgeClass(status: EmployeeStatus) {
  switch (status) {
    case 'inactive':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'active':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
}

function getStatusLabel(status: EmployeeStatus) {
  return status === 'inactive' ? 'Inactivo' : 'Activo';
}

function getJobTitleLabel(jobTitle: StudentJobTitle | null | undefined) {
  switch (jobTitle) {
    case 'general_manager':
      return 'Gerencia';
    case 'finance':
      return 'Finanzas';
    case 'sales':
      return 'Ventas';
    case 'operations':
      return 'Operaciones';
    case 'hr':
      return 'Recursos Humanos';
    case 'unassigned':
    default:
      return 'Sin asignar';
  }
}

function isValidStudentJobTitle(value: unknown): value is StudentJobTitle {
  return (
    value === 'unassigned' ||
    value === 'general_manager' ||
    value === 'finance' ||
    value === 'sales' ||
    value === 'operations' ||
    value === 'hr'
  );
}

function inferDepartmentFromJobTitle(jobTitle: StudentJobTitle) {
  switch (jobTitle) {
    case 'general_manager':
      return 'Dirección';
    case 'finance':
      return 'Finanzas';
    case 'sales':
      return 'Ventas';
    case 'operations':
      return 'Operaciones';
    case 'hr':
      return 'Recursos Humanos';
    case 'unassigned':
    default:
      return '';
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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

function EmployeeModalShell({
  title,
  description,
  onRequestClose,
  footer,
  children,
}: {
  title: string;
  description: string;
  onRequestClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onRequestClose();
        }
      }}
    >
      <div className="flex min-h-dvh items-end justify-center p-0 sm:items-center sm:p-4">
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-3xl">
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
              onClick={onRequestClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-slate-500 transition hover:text-[var(--app-fg)]"
              aria-label="Cerrar modal"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          <div className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeesPage({ isDarkMode, onToggleTheme }: EmployeesPageProps) {
  const navigate = useNavigate();
  const { signOutUser } = useAuth();

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [teamStudents, setTeamStudents] = useState<LinkedStudentOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeCompanyFilter, setEmployeeCompanyFilter] = useState('all');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<'all' | EmployeeStatus>('all');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [salary, setSalary] = useState('0');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatePositionCustom, setIsCreatePositionCustom] = useState(false);
  const [createCustomPosition, setCreateCustomPosition] = useState('');
  const [isCreateDepartmentCustom, setIsCreateDepartmentCustom] = useState(false);
  const [createCustomDepartment, setCreateCustomDepartment] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [editSelectedCompanyId, setEditSelectedCompanyId] = useState('');
  const [editSelectedStudentId, setEditSelectedStudentId] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editSalary, setEditSalary] = useState('0');
  const [editStatus, setEditStatus] = useState<EmployeeStatus>('active');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditPositionCustom, setIsEditPositionCustom] = useState(false);
  const [editCustomPosition, setEditCustomPosition] = useState('');
  const [isEditDepartmentCustom, setIsEditDepartmentCustom] = useState(false);
  const [editCustomDepartment, setEditCustomDepartment] = useState('');
  const [editLockedStudentName, setEditLockedStudentName] = useState('');

  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [closeTarget, setCloseTarget] = useState<'create' | 'edit' | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const editSelectedCompany = useMemo(
    () => companies.find((company) => company.id === editSelectedCompanyId) ?? null,
    [companies, editSelectedCompanyId]
  );

  const selectedStudent = useMemo(
    () => teamStudents.find((student) => student.uid === selectedStudentId) ?? null,
    [teamStudents, selectedStudentId]
  );

  const positionOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...BASE_POSITION_OPTIONS,
        ...employees.map((employee) => employee.position),
        ...teamStudents.map((student) => getJobTitleLabel(student.jobTitle)),
      ]),
    [employees, teamStudents]
  );

  const departmentOptions = useMemo(
    () =>
      uniqueNonEmpty([
        ...BASE_DEPARTMENT_OPTIONS,
        ...employees.map((employee) => employee.department),
      ]),
    [employees]
  );

  const employeeMetrics = useMemo(() => {
    return employees.reduce(
      (accumulator, employee) => {
        accumulator.total += 1;
        if (employee.status === 'active') accumulator.active += 1;
        if (employee.status === 'inactive') accumulator.inactive += 1;
        accumulator.payroll += employee.salary;
        return accumulator;
      },
      { total: 0, active: 0, inactive: 0, payroll: 0 }
    );
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = employeeSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch = normalizedSearch
        ? [
            employee.fullName,
            employee.companyName,
            employee.position,
            employee.department,
            employee.teamName,
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch)
        : true;

      const matchesCompany =
        employeeCompanyFilter === 'all' || employee.companyId === employeeCompanyFilter;

      const matchesStatus =
        employeeStatusFilter === 'all' || employee.status === employeeStatusFilter;

      return matchesSearch && matchesCompany && matchesStatus;
    });
  }, [employees, employeeSearch, employeeCompanyFilter, employeeStatusFilter]);

  const availableStudentsForCreate = useMemo(() => {
    if (!selectedCompany) {
      return teamStudents;
    }

    const usedStudentIds = new Set(
      employees
        .filter((employee) => employee.companyId === selectedCompany.id)
        .map((employee) => employee.linkedStudentId)
        .filter((value): value is string => Boolean(value))
    );

    const usedNames = new Set(
      employees
        .filter((employee) => employee.companyId === selectedCompany.id)
        .map((employee) => employee.fullName.trim().toLowerCase())
        .filter(Boolean)
    );

    return teamStudents.filter(
      (student) =>
        !usedStudentIds.has(student.uid) &&
        !usedNames.has(student.fullName.trim().toLowerCase())
    );
  }, [employees, selectedCompany, teamStudents]);

  const createModalHasUnsavedChanges =
    Boolean(selectedCompanyId) ||
    Boolean(selectedStudentId) ||
    Boolean(fullName.trim()) ||
    Boolean(position.trim()) ||
    Boolean(department.trim()) ||
    salary !== '0' ||
    status !== 'active' ||
    isCreatePositionCustom ||
    Boolean(createCustomPosition.trim()) ||
    isCreateDepartmentCustom ||
    Boolean(createCustomDepartment.trim());

  const editModalHasUnsavedChanges = Boolean(
    selectedEmployee &&
      (
        editFullName.trim() !== selectedEmployee.fullName ||
        editPosition.trim() !== selectedEmployee.position ||
        editDepartment.trim() !== selectedEmployee.department ||
        Number(editSalary) !== selectedEmployee.salary ||
        editStatus !== selectedEmployee.status ||
        isEditPositionCustom ||
        Boolean(editCustomPosition.trim()) ||
        isEditDepartmentCustom ||
        Boolean(editCustomDepartment.trim())
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

  const loadCompanies = async () => {
    try {
      const companiesSnapshot = await getDocs(
        query(collection(db, 'companies'), orderBy('tradeName'))
      );

      const nextCompanies: CompanyOption[] = companiesSnapshot.docs.map((document) => {
        const data = document.data();

        return {
          id: String(document.id),
          teamId: String(data.teamId ?? ''),
          teamName: String(data.teamName ?? ''),
          tradeName: String(data.tradeName ?? ''),
        };
      });

      setCompanies(nextCompanies);
    } catch (error) {
      console.error('Error cargando empresas:', error);
      toast.error(
        'No se pudieron cargar las empresas',
        'Verifica la colección companies y vuelve a intentarlo.'
      );
    }
  };

  const loadEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      const employeesSnapshot = await getDocs(
        query(collection(db, 'employees'), orderBy('fullName'))
      );

      const nextEmployees: EmployeeRecord[] = employeesSnapshot.docs.map((document) => {
        const data = document.data();

        return {
          id: String(document.id),
          companyId: String(data.companyId ?? ''),
          companyName: String(data.companyName ?? ''),
          teamId: String(data.teamId ?? ''),
          teamName: String(data.teamName ?? ''),
          linkedStudentId: typeof data.linkedStudentId === 'string' ? data.linkedStudentId : null,
          fullName: String(data.fullName ?? ''),
          position: String(data.position ?? ''),
          department: String(data.department ?? ''),
          salary: Number(data.salary ?? 0),
          status: data.status === 'inactive' ? 'inactive' : 'active',
        };
      });

      setEmployees(nextEmployees);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      toast.error(
        'No se pudieron cargar los empleados',
        'Verifica la colección employees y vuelve a intentarlo.'
      );
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const loadStudentsForTeam = async (teamId: string) => {
    try {
      if (!teamId) {
        setTeamStudents([]);
        return;
      }

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
            jobTitle: isValidStudentJobTitle(data.jobTitle)
              ? data.jobTitle
              : 'unassigned',
          };
        })
        .filter((student) => student.role === 'student' && student.status !== 'inactive')
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

  useEffect(() => {
    void Promise.all([loadCompanies(), loadEmployees()]);
  }, []);

  useEffect(() => {
    void loadStudentsForTeam(selectedCompany?.teamId ?? '');
    setSelectedStudentId('');
    setFullName('');
    setPosition('');
    setDepartment('');
  }, [selectedCompany?.teamId]);

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }

    setFullName(selectedStudent.fullName);

    if (!position.trim() || BASE_POSITION_OPTIONS.includes(position)) {
      const inferredPosition = getJobTitleLabel(selectedStudent.jobTitle);
      if (inferredPosition !== 'Sin asignar') {
        setPosition(inferredPosition);
      }
    }

    if (!department.trim() || BASE_DEPARTMENT_OPTIONS.includes(department)) {
      const inferredDepartment = inferDepartmentFromJobTitle(selectedStudent.jobTitle);
      if (inferredDepartment) {
        setDepartment(inferredDepartment);
      }
    }
  }, [selectedStudent]);

  const resetCreateForm = () => {
    setSelectedCompanyId('');
    setSelectedStudentId('');
    setFullName('');
    setPosition('');
    setDepartment('');
    setSalary('0');
    setStatus('active');
    setIsCreatePositionCustom(false);
    setCreateCustomPosition('');
    setIsCreateDepartmentCustom(false);
    setCreateCustomDepartment('');
    setTeamStudents([]);
  };

  const resetEditForm = () => {
    setSelectedEmployee(null);
    setEditSelectedCompanyId('');
    setEditSelectedStudentId('');
    setEditFullName('');
    setEditPosition('');
    setEditDepartment('');
    setEditSalary('0');
    setEditStatus('active');
    setIsEditPositionCustom(false);
    setEditCustomPosition('');
    setIsEditDepartmentCustom(false);
    setEditCustomDepartment('');
    setEditLockedStudentName('');
  };

  const closeCreateModalNow = () => {
    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  const closeEditModalNow = () => {
    resetEditForm();
  };

  const handleRequestCloseCreateModal = () => {
    if (isSaving) return;
    if (createModalHasUnsavedChanges) {
      setCloseTarget('create');
      return;
    }
    closeCreateModalNow();
  };

  const handleRequestCloseEditModal = () => {
    if (isUpdating) return;
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

  const handleCreateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCompany) {
      toast.warning('Empresa requerida', 'Debes seleccionar la empresa donde trabajará el empleado.');
      return;
    }
    if (!selectedStudentId) {
      toast.warning('Colaborador requerido', 'Debes seleccionar un estudiante del equipo para crear el empleado.');
      return;
    }
    if (!fullName.trim() || !position.trim() || !department.trim()) {
      toast.warning('Campos incompletos', 'Debes completar nombre, puesto y departamento.');
      return;
    }

    const parsedSalary = Number(salary);
    if (!salary || !Number.isFinite(parsedSalary) || parsedSalary < 0) {
      toast.warning('Salario inválido', 'El salario debe ser un número válido igual o mayor a cero.');
      return;
    }

    try {
      setIsSaving(true);
      const employeeRef = doc(collection(db, 'employees'));
      await setDoc(employeeRef, {
        companyId: selectedCompany.id,
        companyName: selectedCompany.tradeName,
        teamId: selectedCompany.teamId,
        teamName: selectedCompany.teamName,
        linkedStudentId: selectedStudentId,
        fullName: fullName.trim(),
        position: position.trim(),
        department: department.trim(),
        salary: parsedSalary,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success('Empleado creado', 'El registro del empleado se guardó correctamente.');
      closeCreateModalNow();
      await loadEmployees();
    } catch (error) {
      console.error('Error creando empleado:', error);
      toast.error('No se pudo crear el empleado', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditModal = (employee: EmployeeRecord) => {
    setSelectedEmployee(employee);
    setEditSelectedCompanyId(employee.companyId);
    setEditSelectedStudentId(employee.linkedStudentId ?? '');
    setEditLockedStudentName(employee.fullName);
    setEditFullName(employee.fullName);
    setEditPosition(employee.position);
    setEditDepartment(employee.department);
    setEditSalary(String(employee.salary));
    setEditStatus(employee.status);
    setIsEditPositionCustom(false);
    setEditCustomPosition('');
    setIsEditDepartmentCustom(false);
    setEditCustomDepartment('');
  };

  const handleUpdateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedEmployee) return;
    if (!editFullName.trim() || !editPosition.trim() || !editDepartment.trim()) {
      toast.warning('Campos incompletos', 'Debes completar nombre, puesto y departamento.');
      return;
    }

    const parsedSalary = Number(editSalary);
    if (!editSalary || !Number.isFinite(parsedSalary) || parsedSalary < 0) {
      toast.warning('Salario inválido', 'El salario debe ser un número válido igual o mayor a cero.');
      return;
    }

    try {
      setIsUpdating(true);
      await updateDoc(doc(db, 'employees', selectedEmployee.id), {
        fullName: editFullName.trim(),
        position: editPosition.trim(),
        department: editDepartment.trim(),
        salary: parsedSalary,
        status: editStatus,
        updatedAt: serverTimestamp(),
      });

      toast.success('Empleado actualizado', 'Los cambios del empleado se guardaron correctamente.');
      closeEditModalNow();
      await loadEmployees();
    } catch (error) {
      console.error('Error actualizando empleado:', error);
      toast.error('No se pudo actualizar el empleado', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, 'employees', employeeToDelete.id));
      toast.success('Empleado eliminado', 'El empleado fue eliminado correctamente.');
      setEmployeeToDelete(null);
      await loadEmployees();
    } catch (error) {
      console.error('Error eliminando empleado:', error);
      toast.error('No se pudo eliminar el empleado', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <AppShell
        title="Empleados"
        subtitle="Crea la base de empleados simulados y controla su registro administrativo."
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
        onOpenProfile={handleOpenProfile}
      >
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-6">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Listado de empleados</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Crea la base de empleados simulados que luego alimentará planilla y operación mensual.
              </p>
            </div>
            <button type="button" onClick={() => setIsCreateModalOpen(true)} className={`${positiveActionButtonClass} w-full sm:w-auto`}>
              Crear empleado
            </button>
          </header>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Empleados totales</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{employeeMetrics.total}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Activos</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{employeeMetrics.active}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Inactivos</p>
              <p className="mt-2 text-2xl font-semibold text-slate-700 dark:text-slate-200">{employeeMetrics.inactive}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Planilla base</p>
              <p className="mt-2 text-2xl font-semibold text-sky-700 dark:text-sky-300">{formatCurrency(employeeMetrics.payroll)}</p>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_220px]">
              <div>
                <label htmlFor="employeeSearch" className="mb-2 block text-xs text-slate-500 dark:text-slate-400">Buscar empleado</label>
                <input
                  id="employeeSearch"
                  type="text"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Nombre, empresa, puesto, departamento o equipo"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="employeeCompanyFilter" className="mb-2 block text-xs text-slate-500 dark:text-slate-400">Filtrar por empresa</label>
                <select
                  id="employeeCompanyFilter"
                  value={employeeCompanyFilter}
                  onChange={(event) => setEmployeeCompanyFilter(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="all">Todas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.tradeName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="employeeStatusFilter" className="mb-2 block text-xs text-slate-500 dark:text-slate-400">Filtrar por estado</label>
                <select
                  id="employeeStatusFilter"
                  value={employeeStatusFilter}
                  onChange={(event) => setEmployeeStatusFilter(event.target.value as 'all' | EmployeeStatus)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5">Mostrando {filteredEmployees.length} empleado(s)</span>
              {(employeeSearch.trim() || employeeCompanyFilter !== 'all' || employeeStatusFilter !== 'all') ? (
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeSearch('');
                    setEmployeeCompanyFilter('all');
                    setEmployeeStatusFilter('all');
                  }}
                  className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 font-medium text-slate-600 transition hover:text-[var(--app-fg)] dark:text-slate-300"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </div>

          {isLoadingEmployees ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              Cargando empleados...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              {employeeSearch.trim() || employeeCompanyFilter !== 'all' || employeeStatusFilter !== 'all'
                ? 'No hay empleados que coincidan con los filtros aplicados.'
                : 'No hay empleados registrados todavía.'}
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:hidden">
                {filteredEmployees.map((employee) => (
                  <article key={employee.id} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--app-fg)]">{employee.fullName}</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{employee.companyName}</p>
                      </div>
                      <span className={['inline-flex rounded-full border px-3 py-1 text-xs font-medium', getStatusBadgeClass(employee.status)].join(' ')}>
                        {getStatusLabel(employee.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Puesto</p>
                        <p className="mt-2 text-sm font-medium text-[var(--app-fg)]">{employee.position}</p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Departamento</p>
                        <p className="mt-2 text-sm font-medium text-[var(--app-fg)]">{employee.department}</p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Salario</p>
                        <p className="mt-2 text-sm font-medium text-[var(--app-fg)]">{formatCurrency(employee.salary)}</p>
                      </div>
                      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Equipo</p>
                        <p className="mt-2 text-sm font-medium text-[var(--app-fg)]">{employee.teamName}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button type="button" onClick={() => handleOpenEditModal(employee)} className={neutralActionButtonClass}>
                        Editar
                      </button>
                      <button type="button" onClick={() => setEmployeeToDelete(employee)} className={negativeActionButtonClass}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--app-border)] lg:block">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse table-fixed">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[13rem]" />
                  </colgroup>
                  <thead className="bg-[var(--app-surface-muted)]">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Empresa</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Puesto</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Departamento</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Salario</th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">Estado</th>
                      <th className="px-4 py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.id} className="border-t border-[color:var(--app-border)]">
                        <td className="px-4 py-4 text-sm text-[var(--app-fg)]">{employee.fullName}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{employee.companyName}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{employee.position}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{employee.department}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(employee.salary)}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={['inline-flex rounded-full border px-3 py-1 text-xs font-medium', getStatusBadgeClass(employee.status)].join(' ')}>
                            {getStatusLabel(employee.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => handleOpenEditModal(employee)} className={neutralActionButtonClass}>
                              Editar
                            </button>
                            <button type="button" onClick={() => setEmployeeToDelete(employee)} className={negativeActionButtonClass}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </section>
      </AppShell>

      {isCreateModalOpen ? (
        <EmployeeModalShell
          title="Crear empleado"
          description="Selecciona primero la empresa y luego el integrante del equipo para vincularlo como empleado simulado."
          onRequestClose={handleRequestCloseCreateModal}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleRequestCloseCreateModal} disabled={isSaving} className={neutralActionButtonClass}>
                Cancelar
              </button>
              <button type="submit" form="createEmployeeForm" disabled={isSaving} className={positiveActionButtonClass}>
                {isSaving ? 'Guardando...' : 'Crear empleado'}
              </button>
            </div>
          }
        >
          <form id="createEmployeeForm" className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6" onSubmit={handleCreateEmployee}>
            <div>
              <label htmlFor="selectedCompanyId" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Empresa
              </label>
              <select
                id="selectedCompanyId"
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="selectedStudentId" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre completo
              </label>
              <select
                id="selectedStudentId"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
              >
                <option value="">Selecciona un integrante del equipo</option>
                {availableStudentsForCreate.map((student) => (
                  <option key={student.uid} value={student.uid}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              {selectedCompany && availableStudentsForCreate.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Todos los integrantes de este equipo ya fueron vinculados como empleados para esta empresa.
                </p>
              ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label htmlFor="position" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Puesto
                </label>
                <select
                  id="position"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  disabled={isCreatePositionCustom}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:opacity-60"
                >
                  <option value="">Selecciona un puesto</option>
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIsCreatePositionCustom((current) => !current)}
                  className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-lg font-semibold text-[var(--app-fg)] transition hover:bg-[var(--app-bg)]"
                  aria-label="Agregar puesto personalizado"
                  title="Agregar puesto personalizado"
                >
                  +
                </button>
              </div>
            </div>

            {isCreatePositionCustom ? (
              <div>
                <label htmlFor="createCustomPosition" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nuevo puesto personalizado
                </label>
                <input
                  id="createCustomPosition"
                  type="text"
                  value={createCustomPosition}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCreateCustomPosition(value);
                    setPosition(value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label htmlFor="department" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Departamento
                </label>
                <select
                  id="department"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  disabled={isCreateDepartmentCustom}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:opacity-60"
                >
                  <option value="">Selecciona un departamento</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIsCreateDepartmentCustom((current) => !current)}
                  className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-lg font-semibold text-[var(--app-fg)] transition hover:bg-[var(--app-bg)]"
                  aria-label="Agregar departamento personalizado"
                  title="Agregar departamento personalizado"
                >
                  +
                </button>
              </div>
            </div>

            {isCreateDepartmentCustom ? (
              <div>
                <label htmlFor="createCustomDepartment" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nuevo departamento personalizado
                </label>
                <input
                  id="createCustomDepartment"
                  type="text"
                  value={createCustomDepartment}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCreateCustomDepartment(value);
                    setDepartment(value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="salary" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Salario mensual base
                </label>
                <input
                  id="salary"
                  type="text"
                  inputMode="decimal"
                  value={salary}
                  onChange={(event) => {
                    const normalized = normalizePositiveNumberInput(event.target.value);
                    setSalary(normalized.value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="status" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estado
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as EmployeeStatus)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
              {selectedCompany
                ? selectedStudent
                  ? `Se vinculará a ${selectedCompany.tradeName}. El nombre se toma directamente del estudiante seleccionado para minimizar errores de digitación.`
                  : 'Selecciona la empresa y luego el estudiante vinculado para minimizar errores de digitación.'
                : 'Selecciona la empresa y luego el estudiante vinculado para minimizar errores de digitación.'}
            </div>
          </form>
        </EmployeeModalShell>
      ) : null}

      {selectedEmployee ? (
        <EmployeeModalShell
          title="Editar empleado"
          description="Aquí solo editas el empleado que seleccionaste en la tabla."
          onRequestClose={handleRequestCloseEditModal}
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={handleRequestCloseEditModal} disabled={isUpdating} className={neutralActionButtonClass}>
                Cancelar
              </button>
              <button type="submit" form="editEmployeeForm" disabled={isUpdating} className={positiveActionButtonClass}>
                {isUpdating ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          }
        >
          <form id="editEmployeeForm" className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6" onSubmit={handleUpdateEmployee}>
            <div>
              <label className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Empresa
              </label>
              <input
                type="text"
                value={editSelectedCompany?.tradeName ?? ''}
                disabled
                className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] opacity-70 outline-none disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nombre completo
              </label>
              <input
                type="text"
                value={editLockedStudentName || editFullName}
                disabled
                className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] opacity-70 outline-none disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label htmlFor="editPosition" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Puesto
                </label>
                <select
                  id="editPosition"
                  value={editPosition}
                  onChange={(event) => setEditPosition(event.target.value)}
                  disabled={isEditPositionCustom}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:opacity-60"
                >
                  <option value="">Selecciona un puesto</option>
                  {positionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIsEditPositionCustom((current) => !current)}
                  className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-lg font-semibold text-[var(--app-fg)] transition hover:bg-[var(--app-bg)]"
                  aria-label="Agregar puesto personalizado"
                  title="Agregar puesto personalizado"
                >
                  +
                </button>
              </div>
            </div>

            {isEditPositionCustom ? (
              <div>
                <label htmlFor="editCustomPosition" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nuevo puesto personalizado
                </label>
                <input
                  id="editCustomPosition"
                  type="text"
                  value={editCustomPosition}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditCustomPosition(value);
                    setEditPosition(value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label htmlFor="editDepartment" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Departamento
                </label>
                <select
                  id="editDepartment"
                  value={editDepartment}
                  onChange={(event) => setEditDepartment(event.target.value)}
                  disabled={isEditDepartmentCustom}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:opacity-60"
                >
                  <option value="">Selecciona un departamento</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIsEditDepartmentCustom((current) => !current)}
                  className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-lg font-semibold text-[var(--app-fg)] transition hover:bg-[var(--app-bg)]"
                  aria-label="Agregar departamento personalizado"
                  title="Agregar departamento personalizado"
                >
                  +
                </button>
              </div>
            </div>

            {isEditDepartmentCustom ? (
              <div>
                <label htmlFor="editCustomDepartment" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nuevo departamento personalizado
                </label>
                <input
                  id="editCustomDepartment"
                  type="text"
                  value={editCustomDepartment}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditCustomDepartment(value);
                    setEditDepartment(value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="editSalary" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Salario mensual base
                </label>
                <input
                  id="editSalary"
                  type="text"
                  inputMode="decimal"
                  value={editSalary}
                  onChange={(event) => {
                    const normalized = normalizePositiveNumberInput(event.target.value);
                    setEditSalary(normalized.value);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="editStatus" className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estado
                </label>
                <select
                  id="editStatus"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as EmployeeStatus)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
          </form>
        </EmployeeModalShell>
      ) : null}

      {employeeToDelete ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <header>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                Eliminar empleado
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Esta acción eliminará el registro de{' '}
                <span className="font-medium text-[var(--app-fg)]">
                  {employeeToDelete.fullName}
                </span>
                .
              </p>
            </header>
            <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm font-medium text-[var(--app-fg)]">Empresa vinculada</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {employeeToDelete.companyName}
              </p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                disabled={isDeleting}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteEmployee}
                disabled={isDeleting}
                className={negativeActionButtonClass}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar empleado'}
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
