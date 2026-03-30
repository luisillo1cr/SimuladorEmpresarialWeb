import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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
import { normalizePositiveNumberInput } from '../utils/numeric';

type CompanyOperationsPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type CompanyRecord = {
  id: string;
  teamId: string;
  teamName: string;
  businessName: string;
  tradeName: string;
  legalId: string;
  industry: string;
};

type OperationStatus = 'draft' | 'closed';

type MonthlyOperationRecord = {
  id: string;
  companyId: string;
  teamId: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  openingCash: number;
  salesIncome: number;
  serviceIncome: number;
  otherIncome: number;
  operatingExpenses: number;
  payrollExpenses: number;
  rentUtilitiesExpenses: number;
  simplifiedTax: number;
  totalIncome: number;
  totalExpenses: number;
  closingCash: number;
  netResult: number;
  notes: string;
  status: OperationStatus;
};

type HelpLabelProps = {
  htmlFor: string;
  label: string;
  helpText: string;
};

type MoneyFieldKey =
  | 'openingCash'
  | 'salesIncome'
  | 'serviceIncome'
  | 'otherIncome'
  | 'operatingExpenses'
  | 'payrollExpenses'
  | 'rentUtilitiesExpenses'
  | 'simplifiedTax';

type MoneyFieldErrors = Record<MoneyFieldKey, string>;

function HelpLabel({ htmlFor, label, helpText }: HelpLabelProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>

      <div className="group relative flex items-center">
        <button
          type="button"
          tabIndex={0}
          aria-label={`Información sobre ${label}`}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-[11px] font-semibold text-slate-500 transition hover:border-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-200"
        >
          i
        </button>

        <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left text-xs leading-5 text-slate-600 shadow-2xl group-hover:block group-focus-within:block dark:text-slate-300">
          {helpText}
        </div>
      </div>
    </div>
  );
}

function getPeriodLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-CR', {
    month: 'long',
    year: 'numeric',
  });
}

function clampMoneyValue(value: string | number) {
  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2,
  }).format(value);
}

function getEmptyMoneyFieldErrors(): MoneyFieldErrors {
  return {
    openingCash: '',
    salesIncome: '',
    serviceIncome: '',
    otherIncome: '',
    operatingExpenses: '',
    payrollExpenses: '',
    rentUtilitiesExpenses: '',
    simplifiedTax: '',
  };
}

export function CompanyOperationsPage({
  isDarkMode,
  onToggleTheme,
}: CompanyOperationsPageProps) {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const { profile, signOutUser } = useAuth();

  const currentDate = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [operationStatus, setOperationStatus] = useState<OperationStatus>('draft');

  const [openingCash, setOpeningCash] = useState('0');
  const [salesIncome, setSalesIncome] = useState('0');
  const [serviceIncome, setServiceIncome] = useState('0');
  const [otherIncome, setOtherIncome] = useState('0');
  const [operatingExpenses, setOperatingExpenses] = useState('0');
  const [payrollExpenses, setPayrollExpenses] = useState('0');
  const [rentUtilitiesExpenses, setRentUtilitiesExpenses] = useState('0');
  const [simplifiedTax, setSimplifiedTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [moneyFieldErrors, setMoneyFieldErrors] = useState<MoneyFieldErrors>(
    getEmptyMoneyFieldErrors()
  );

  const isStudent = profile?.role === 'student';
  const isLockedForStudent = isStudent && operationStatus === 'closed';

  const totalIncome = useMemo(() => {
    return (
      clampMoneyValue(salesIncome) +
      clampMoneyValue(serviceIncome) +
      clampMoneyValue(otherIncome)
    );
  }, [salesIncome, serviceIncome, otherIncome]);

  const totalExpenses = useMemo(() => {
    return (
      clampMoneyValue(operatingExpenses) +
      clampMoneyValue(payrollExpenses) +
      clampMoneyValue(rentUtilitiesExpenses) +
      clampMoneyValue(simplifiedTax)
    );
  }, [
    operatingExpenses,
    payrollExpenses,
    rentUtilitiesExpenses,
    simplifiedTax,
  ]);

  const closingCash = useMemo(() => {
    return clampMoneyValue(openingCash) + totalIncome - totalExpenses;
  }, [openingCash, totalIncome, totalExpenses]);

  const netResult = useMemo(() => {
    return totalIncome - totalExpenses;
  }, [totalIncome, totalExpenses]);

  const periodLabel = useMemo(() => {
    return getPeriodLabel(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  const clearAllMoneyFieldErrors = () => {
    setMoneyFieldErrors(getEmptyMoneyFieldErrors());
  };

  const handleMoneyFieldChange = (
    field: MoneyFieldKey,
    rawValue: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const normalized = normalizePositiveNumberInput(rawValue);

    setter(normalized.value);
    setMoneyFieldErrors((current) => ({
      ...current,
      [field]: normalized.error,
    }));
  };

  useEffect(() => {
    const loadCompany = async () => {
      if (!companyId || !profile) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const companyRef = doc(db, 'companies', companyId);
        const companySnapshot = await getDoc(companyRef);

        if (!companySnapshot.exists()) {
          toast.error(
            'Empresa no encontrada',
            'No existe una empresa con ese identificador.'
          );
          setCompany(null);
          return;
        }

        const data = companySnapshot.data();

        const nextCompany: CompanyRecord = {
          id: companySnapshot.id,
          teamId: data.teamId ?? '',
          teamName: data.teamName ?? '',
          businessName: data.businessName ?? '',
          tradeName: data.tradeName ?? '',
          legalId: data.legalId ?? '',
          industry: data.industry ?? '',
        };

        if (
          profile.role === 'student' &&
          profile.teamId !== nextCompany.teamId
        ) {
          toast.error(
            'Acceso no permitido',
            'No puedes acceder a la operación de una empresa que no pertenece a tu equipo.'
          );
          setCompany(null);
          return;
        }

        setCompany(nextCompany);
      } catch {
        toast.error(
          'No se pudo cargar la empresa',
          'Verifica las reglas y vuelve a intentarlo.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadCompany();
  }, [companyId, profile]);

  useEffect(() => {
    const loadOperation = async () => {
      if (!company) {
        return;
      }

      try {
        const operationsRef = collection(db, 'monthlyOperations');
        const operationsQuery = query(
          operationsRef,
          where('teamId', '==', company.teamId)
        );

        const operationsSnapshot = await getDocs(operationsQuery);

        const matchingOperation = operationsSnapshot.docs
          .map((document): MonthlyOperationRecord => {
            const data = document.data();

            return {
              id: document.id,
              companyId: data.companyId ?? '',
              teamId: data.teamId ?? '',
              periodYear: Number(data.periodYear ?? 0),
              periodMonth: Number(data.periodMonth ?? 0),
              periodLabel: data.periodLabel ?? '',
              openingCash: Number(data.openingCash ?? 0),
              salesIncome: Number(data.salesIncome ?? 0),
              serviceIncome: Number(data.serviceIncome ?? 0),
              otherIncome: Number(data.otherIncome ?? 0),
              operatingExpenses: Number(data.operatingExpenses ?? 0),
              payrollExpenses: Number(data.payrollExpenses ?? 0),
              rentUtilitiesExpenses: Number(data.rentUtilitiesExpenses ?? 0),
              simplifiedTax: Number(data.simplifiedTax ?? 0),
              totalIncome: Number(data.totalIncome ?? 0),
              totalExpenses: Number(data.totalExpenses ?? 0),
              closingCash: Number(data.closingCash ?? 0),
              netResult: Number(data.netResult ?? 0),
              notes: data.notes ?? '',
              status: data.status === 'closed' ? 'closed' : 'draft',
            };
          })
          .find(
            (operation) =>
              operation.companyId === company.id &&
              operation.periodYear === selectedYear &&
              operation.periodMonth === selectedMonth
          );

        clearAllMoneyFieldErrors();

        if (!matchingOperation) {
          setOpeningCash('0');
          setSalesIncome('0');
          setServiceIncome('0');
          setOtherIncome('0');
          setOperatingExpenses('0');
          setPayrollExpenses('0');
          setRentUtilitiesExpenses('0');
          setSimplifiedTax('0');
          setNotes('');
          setOperationStatus('draft');
          return;
        }

        setOpeningCash(String(clampMoneyValue(matchingOperation.openingCash)));
        setSalesIncome(String(clampMoneyValue(matchingOperation.salesIncome)));
        setServiceIncome(String(clampMoneyValue(matchingOperation.serviceIncome)));
        setOtherIncome(String(clampMoneyValue(matchingOperation.otherIncome)));
        setOperatingExpenses(
          String(clampMoneyValue(matchingOperation.operatingExpenses))
        );
        setPayrollExpenses(
          String(clampMoneyValue(matchingOperation.payrollExpenses))
        );
        setRentUtilitiesExpenses(
          String(clampMoneyValue(matchingOperation.rentUtilitiesExpenses))
        );
        setSimplifiedTax(String(clampMoneyValue(matchingOperation.simplifiedTax)));
        setNotes(matchingOperation.notes ?? '');
        setOperationStatus(
          matchingOperation.status === 'closed' ? 'closed' : 'draft'
        );
      } catch {
        toast.error(
          'No se pudo cargar la operación',
          'Verifica las reglas y vuelve a intentarlo.'
        );
      }
    };

    void loadOperation();
  }, [company, selectedYear, selectedMonth]);

  const handleSaveOperation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!company || !profile) {
      return;
    }

    if (isLockedForStudent) {
      toast.warning(
        'Período cerrado',
        'Este período ya fue cerrado y no puede ser modificado por estudiantes.'
      );
      return;
    }

    try {
      setIsSaving(true);

      const operationId = `${company.id}_${selectedYear}_${String(
        selectedMonth
      ).padStart(2, '0')}`;

      const safeOpeningCash = clampMoneyValue(openingCash);
      const safeSalesIncome = clampMoneyValue(salesIncome);
      const safeServiceIncome = clampMoneyValue(serviceIncome);
      const safeOtherIncome = clampMoneyValue(otherIncome);
      const safeOperatingExpenses = clampMoneyValue(operatingExpenses);
      const safePayrollExpenses = clampMoneyValue(payrollExpenses);
      const safeRentUtilitiesExpenses = clampMoneyValue(rentUtilitiesExpenses);
      const safeSimplifiedTax = clampMoneyValue(simplifiedTax);

      const safeTotalIncome =
        safeSalesIncome + safeServiceIncome + safeOtherIncome;

      const safeTotalExpenses =
        safeOperatingExpenses +
        safePayrollExpenses +
        safeRentUtilitiesExpenses +
        safeSimplifiedTax;

      const safeClosingCash =
        safeOpeningCash + safeTotalIncome - safeTotalExpenses;

      const safeNetResult = safeTotalIncome - safeTotalExpenses;

      const operationRef = doc(db, 'monthlyOperations', operationId);

      await setDoc(
        operationRef,
        {
          companyId: company.id,
          companyName: company.tradeName,
          teamId: company.teamId,
          teamName: company.teamName,
          periodYear: selectedYear,
          periodMonth: selectedMonth,
          periodLabel,
          openingCash: safeOpeningCash,
          salesIncome: safeSalesIncome,
          serviceIncome: safeServiceIncome,
          otherIncome: safeOtherIncome,
          operatingExpenses: safeOperatingExpenses,
          payrollExpenses: safePayrollExpenses,
          rentUtilitiesExpenses: safeRentUtilitiesExpenses,
          simplifiedTax: safeSimplifiedTax,
          totalIncome: safeTotalIncome,
          totalExpenses: safeTotalExpenses,
          closingCash: safeClosingCash,
          netResult: safeNetResult,
          notes: notes.trim(),
          status: operationStatus,
          updatedAt: serverTimestamp(),
          createdBy: profile.uid,
        },
        { merge: true }
      );

      setOpeningCash(String(safeOpeningCash));
      setSalesIncome(String(safeSalesIncome));
      setServiceIncome(String(safeServiceIncome));
      setOtherIncome(String(safeOtherIncome));
      setOperatingExpenses(String(safeOperatingExpenses));
      setPayrollExpenses(String(safePayrollExpenses));
      setRentUtilitiesExpenses(String(safeRentUtilitiesExpenses));
      setSimplifiedTax(String(safeSimplifiedTax));
      clearAllMoneyFieldErrors();

      toast.success(
        'Operación guardada',
        'La operación mensual se guardó correctamente.'
      );
    } catch {
      toast.error(
        'No se pudo guardar la operación',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Operación mensual"
      subtitle="Registro simplificado de ingresos, gastos y resultado del período."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      {isLoading ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Cargando operación mensual...
          </div>
        </section>
      ) : !company ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            No se encontró la empresa o no tienes permiso para verla.
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
                  Registra la operación económica simplificada del período actual
                  de la empresa.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Período
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-fg)]">
                    {periodLabel}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Estado
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-fg)]">
                    {operationStatus === 'closed' ? 'Cerrado' : 'Borrador'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Resultado
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-fg)]">
                    {formatCurrency(netResult)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {isLockedForStudent ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Este período está cerrado.
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                Ya no puedes modificarlo como estudiante. Si necesitas cambios,
                un docente o administrador debe reabrirlo.
              </p>
            </section>
          ) : null}

          <form
            className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]"
            onSubmit={handleSaveOperation}
          >
            <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header className="mb-5">
                <h3 className="text-lg font-semibold">Registro del período</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Completa los movimientos principales del mes de trabajo.
                </p>
              </header>

              <div className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="selectedYear"
                      className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Año
                    </label>
                    <input
                      id="selectedYear"
                      type="number"
                      value={selectedYear}
                      onChange={(event) =>
                        setSelectedYear(Number(event.target.value))
                      }
                      min={2000}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="selectedMonth"
                      className="mb-2.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Mes
                    </label>
                    <select
                      id="selectedMonth"
                      value={selectedMonth}
                      onChange={(event) =>
                        setSelectedMonth(Number(event.target.value))
                      }
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                    >
                      {Array.from({ length: 12 }).map((_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {new Date(2026, index, 1).toLocaleDateString('es-CR', {
                            month: 'long',
                          })}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="operationStatus"
                      label="Estado"
                      helpText="Borrador significa que el período sigue abierto y se puede seguir corrigiendo. Cerrado significa que el equipo lo da por finalizado. Cuando queda cerrado, el estudiante ya no puede editarlo."
                    />
                    <select
                      id="operationStatus"
                      value={operationStatus}
                      onChange={(event) =>
                        setOperationStatus(event.target.value as OperationStatus)
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="draft">Borrador</option>
                      <option value="closed">Cerrado</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <HelpLabel
                      htmlFor="openingCash"
                      label="Caja inicial"
                      helpText="Es el dinero con el que la empresa empieza el período. Piensa en el efectivo o saldo disponible al inicio del mes antes de sumar ventas y restar gastos."
                    />
                    <input
                      id="openingCash"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={openingCash}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'openingCash',
                          event.target.value,
                          setOpeningCash
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.openingCash ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.openingCash}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="salesIncome"
                      label="Ingresos por ventas"
                      helpText="Aquí se registra el dinero que entra por vender productos. Ejemplo: mercadería, artículos o bienes que la empresa comercializa."
                    />
                    <input
                      id="salesIncome"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={salesIncome}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'salesIncome',
                          event.target.value,
                          setSalesIncome
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.salesIncome ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.salesIncome}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="serviceIncome"
                      label="Ingresos por servicios"
                      helpText="Se usa para el dinero recibido por servicios prestados. Ejemplo: asesorías, soporte, mantenimiento, diseño, reparaciones u otros trabajos realizados."
                    />
                    <input
                      id="serviceIncome"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={serviceIncome}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'serviceIncome',
                          event.target.value,
                          setServiceIncome
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.serviceIncome ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.serviceIncome}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="otherIncome"
                      label="Otros ingresos"
                      helpText="Aquí entra cualquier otro dinero recibido que no sea una venta ni un servicio principal. Por ejemplo: comisiones, intereses, alquiler cobrado o ingresos extraordinarios."
                    />
                    <input
                      id="otherIncome"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={otherIncome}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'otherIncome',
                          event.target.value,
                          setOtherIncome
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.otherIncome ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.otherIncome}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="operatingExpenses"
                      label="Gastos operativos"
                      helpText="Son los gastos normales para que el negocio funcione en el día a día. Ejemplo: materiales, transporte, papelería, mantenimiento, combustible o compras menores."
                    />
                    <input
                      id="operatingExpenses"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={operatingExpenses}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'operatingExpenses',
                          event.target.value,
                          setOperatingExpenses
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.operatingExpenses ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.operatingExpenses}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="payrollExpenses"
                      label="Planilla básica"
                      helpText="Es el monto destinado al pago del personal en esta simulación. Aquí puedes incluir salarios o pagos básicos del equipo de trabajo sin entrar todavía en todos los detalles reales de cargas sociales."
                    />
                    <input
                      id="payrollExpenses"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={payrollExpenses}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'payrollExpenses',
                          event.target.value,
                          setPayrollExpenses
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.payrollExpenses ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.payrollExpenses}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="rentUtilitiesExpenses"
                      label="Alquiler y servicios"
                      helpText="Aquí se registra lo que la empresa paga por local y servicios básicos. Ejemplo: alquiler, agua, luz, internet, teléfono o limpieza."
                    />
                    <input
                      id="rentUtilitiesExpenses"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={rentUtilitiesExpenses}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'rentUtilitiesExpenses',
                          event.target.value,
                          setRentUtilitiesExpenses
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.rentUtilitiesExpenses ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.rentUtilitiesExpenses}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <HelpLabel
                      htmlFor="simplifiedTax"
                      label="Impuesto simplificado"
                      helpText="Este campo resume de forma sencilla la carga tributaria del período. En la vida real pueden existir varios impuestos, pero aquí usamos un solo monto estimado para que la simulación sea más clara y manejable."
                    />
                    <input
                      id="simplifiedTax"
                      type="text"
                      inputMode="decimal"
                      min={0}
                      value={simplifiedTax}
                      onChange={(event) =>
                        handleMoneyFieldChange(
                          'simplifiedTax',
                          event.target.value,
                          setSimplifiedTax
                        )
                      }
                      disabled={isLockedForStudent}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                    />
                    {moneyFieldErrors.simplifiedTax ? (
                      <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {moneyFieldErrors.simplifiedTax}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <HelpLabel
                    htmlFor="notes"
                    label="Observaciones del período"
                    helpText="Espacio para anotar decisiones, situaciones especiales o comentarios importantes del período. Ejemplo: baja en ventas, gasto inesperado o cambio en el negocio."
                  />
                  <textarea
                    id="notes"
                    rows={5}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    disabled={isLockedForStudent}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>
            </section>

            <aside className="flex flex-col rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <div>
                <h3 className="text-lg font-semibold">Resumen del período</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Resultado simplificado de la operación mensual.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Período
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {periodLabel}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ingresos totales
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {formatCurrency(totalIncome)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gastos totales
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {formatCurrency(totalExpenses)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Caja final
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {formatCurrency(closingCash)}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Resultado neto
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {formatCurrency(netResult)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSaving || isLockedForStudent}
                  className={positiveActionButtonClass}
                >
                  {isLockedForStudent
                    ? 'Período cerrado'
                    : isSaving
                      ? 'Guardando...'
                      : 'Guardar operación'}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    profile?.role === 'student'
                      ? navigate('/my-company')
                      : navigate(`/admin/companies/${company.id}`)
                  }
                  className={neutralActionButtonClass}
                >
                  Volver
                </button>
              </div>
            </aside>
          </form>
        </div>
      )}
    </AppShell>
  );
}
