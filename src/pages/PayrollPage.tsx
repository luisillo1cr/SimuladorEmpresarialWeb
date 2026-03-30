import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase/config';
import { neutralActionButtonClass, positiveActionButtonClass } from '../utils/buttonStyles';
import { toast } from '../utils/toast';

type PayrollPageProps = { isDarkMode: boolean; onToggleTheme: () => void };
type PayrollType = 'monthly' | 'biweekly' | 'weekly' | 'daily';

type CompanyOption = { id: string; tradeName: string; teamName: string; teamId: string };
type EmployeeRecord = {
  id: string;
  companyId: string;
  fullName: string;
  position: string;
  department: string;
  salary: number;
  status: 'active' | 'inactive';
};

type PayrollRun = {
  id: string;
  companyId: string;
  companyName: string;
  teamId: string;
  teamName: string;
  period: string;
  payrollType: PayrollType;
  periodKey: string;
  employeeCount: number;
  grossTotal: number;
  employeeDeductionsTotal: number;
  employerChargesTotal: number;
  netPayTotal: number;
  status: 'generated';
};

type EmployeePayrollPreview = {
  employeeId: string;
  fullName: string;
  position: string;
  salary: number;
  employeeDeductions: number;
  employerCharges: number;
  netPay: number;
};

const EMPLOYEE_DEDUCTION_RATE = 0.105;
const EMPLOYER_CHARGE_RATE = 0.2667;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function getPayrollTypeLabel(type: PayrollType) {
  switch (type) {
    case 'biweekly':
      return 'Quincenal';
    case 'weekly':
      return 'Semanal';
    case 'daily':
      return 'Diaria';
    default:
      return 'Mensual';
  }
}

function formatDateLabel(value: string) {
  if (!value) return 'Sin definir';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildPayrollPeriod(
  type: PayrollType,
  monthlyValue: string,
  biweeklyPart: '1' | '2',
  weeklyDate: string,
  dailyDate: string,
) {
  if (type === 'monthly') {
    const label = monthlyValue
      ? new Date(`${monthlyValue}-01T00:00:00`).toLocaleDateString('es-CR', {
          month: 'long',
          year: 'numeric',
        })
      : 'Mes sin definir';
    return { period: label, periodKey: `${type}:${monthlyValue}` };
  }

  if (type === 'biweekly') {
    const label = monthlyValue
      ? `${biweeklyPart === '1' ? 'Primera' : 'Segunda'} quincena de ${new Date(
          `${monthlyValue}-01T00:00:00`
        ).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}`
      : 'Quincena sin definir';
    return { period: label, periodKey: `${type}:${monthlyValue}:${biweeklyPart}` };
  }

  if (type === 'weekly') {
    return { period: `Semana del ${formatDateLabel(weeklyDate)}`, periodKey: `${type}:${weeklyDate}` };
  }

  return { period: `Día ${formatDateLabel(dailyDate)}`, periodKey: `${type}:${dailyDate}` };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildEmployeePreview(employee: EmployeeRecord): EmployeePayrollPreview {
  const employeeDeductions = roundMoney(employee.salary * EMPLOYEE_DEDUCTION_RATE);
  const employerCharges = roundMoney(employee.salary * EMPLOYER_CHARGE_RATE);
  const netPay = roundMoney(employee.salary - employeeDeductions);

  return {
    employeeId: employee.id,
    fullName: employee.fullName,
    position: employee.position,
    salary: employee.salary,
    employeeDeductions,
    employerCharges,
    netPay,
  };
}

export function PayrollPage({ isDarkMode, onToggleTheme }: PayrollPageProps) {
  const navigate = useNavigate();
  const { signOutUser } = useAuth();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [payrollType, setPayrollType] = useState<PayrollType>('monthly');
  const [monthlyPeriod, setMonthlyPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [biweeklyPart, setBiweeklyPart] = useState<'1' | '2'>('1');
  const [weeklyDate, setWeeklyDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [companyFilter, setCompanyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PayrollType>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => navigate('/profile');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [companiesSnapshot, employeesSnapshot, runsSnapshot] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'employees')),
        getDocs(query(collection(db, 'payrollRuns'))),
      ]);

      setCompanies(
        companiesSnapshot.docs
          .map((document) => {
            const data = document.data();
            return {
              id: document.id,
              tradeName: String(data.tradeName ?? ''),
              teamName: String(data.teamName ?? ''),
              teamId: String(data.teamId ?? ''),
            };
          })
          .sort((a, b) => a.tradeName.localeCompare(b.tradeName, 'es')),
      );

      setEmployees(
        employeesSnapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            companyId: String(data.companyId ?? ''),
            fullName: String(data.fullName ?? ''),
            position: String(data.position ?? 'Sin puesto'),
            department: String(data.department ?? 'Sin departamento'),
            salary: Number(data.salary ?? 0),
            status: data.status === 'inactive' ? 'inactive' : 'active',
          };
        }),
      );

      setRuns(
        runsSnapshot.docs
          .map((document) => {
            const data = document.data();
            return {
              id: document.id,
              companyId: String(data.companyId ?? ''),
              companyName: String(data.companyName ?? ''),
              teamId: String(data.teamId ?? ''),
              teamName: String(data.teamName ?? ''),
              period: String(data.period ?? ''),
              payrollType:
                data.payrollType === 'biweekly'
                  ? 'biweekly'
                  : data.payrollType === 'weekly'
                    ? 'weekly'
                    : data.payrollType === 'daily'
                      ? 'daily'
                      : 'monthly',
              periodKey: String(data.periodKey ?? `monthly:${String(data.period ?? '')}`),
              employeeCount: Number(data.employeeCount ?? 0),
              grossTotal: Number(data.grossTotal ?? 0),
              employeeDeductionsTotal: Number(data.employeeDeductionsTotal ?? 0),
              employerChargesTotal: Number(data.employerChargesTotal ?? 0),
              netPayTotal: Number(data.netPayTotal ?? 0),
              status: 'generated',
            } satisfies PayrollRun;
          })
          .sort((a, b) => b.periodKey.localeCompare(a.periodKey)),
      );
    } catch (error) {
      console.error('Error cargando planillas:', error);
      toast.error('No se pudo cargar la planilla', 'Verifica las colecciones de planilla y vuelve a intentarlo.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.companyId === selectedCompanyId && employee.status === 'active'),
    [employees, selectedCompanyId],
  );

  const employeePreview = useMemo(
    () => activeEmployees.map((employee) => buildEmployeePreview(employee)),
    [activeEmployees],
  );

  const currentPeriod = useMemo(
    () => buildPayrollPeriod(payrollType, monthlyPeriod, biweeklyPart, weeklyDate, dailyDate),
    [payrollType, monthlyPeriod, biweeklyPart, weeklyDate, dailyDate],
  );

  const previewTotals = useMemo(() => {
    return employeePreview.reduce(
      (accumulator, employee) => ({
        grossTotal: accumulator.grossTotal + employee.salary,
        employeeDeductionsTotal: accumulator.employeeDeductionsTotal + employee.employeeDeductions,
        employerChargesTotal: accumulator.employerChargesTotal + employee.employerCharges,
        netPayTotal: accumulator.netPayTotal + employee.netPay,
      }),
      { grossTotal: 0, employeeDeductionsTotal: 0, employerChargesTotal: 0, netPayTotal: 0 },
    );
  }, [employeePreview]);

  const duplicateRun = useMemo(
    () => runs.find((run) => run.companyId === selectedCompanyId && run.periodKey === currentPeriod.periodKey),
    [runs, selectedCompanyId, currentPeriod.periodKey],
  );

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const matchesCompany = companyFilter === 'all' || run.companyId === companyFilter;
      const matchesType = typeFilter === 'all' || run.payrollType === typeFilter;
      return matchesCompany && matchesType;
    });
  }, [companyFilter, runs, typeFilter]);

  const summary = useMemo(() => {
    return {
      totalRuns: runs.length,
      generatedThisPeriod: runs.filter((run) => run.periodKey.startsWith(`${payrollType}:`)).length,
      companiesWithPayroll: new Set(runs.map((run) => run.companyId)).size,
      totalNetPayroll: runs.reduce((acc, run) => acc + run.netPayTotal, 0),
    };
  }, [runs, payrollType]);

  const handleGeneratePayroll = async () => {
    if (!selectedCompany) {
      toast.warning('Empresa requerida', 'Debes seleccionar una empresa para generar la planilla.');
      return;
    }
    if (activeEmployees.length === 0) {
      toast.warning('Sin empleados activos', 'La empresa seleccionada no tiene empleados activos para planilla.');
      return;
    }
    if (!currentPeriod.periodKey.split(':')[1]) {
      toast.warning('Período requerido', 'Debes completar el período antes de generar la planilla.');
      return;
    }
    if (duplicateRun) {
      toast.warning('Planilla duplicada', 'Ya existe una planilla para esta empresa, tipo y período.');
      return;
    }

    try {
      setIsGenerating(true);
      await addDoc(collection(db, 'payrollRuns'), {
        companyId: selectedCompany.id,
        companyName: selectedCompany.tradeName,
        teamId: selectedCompany.teamId,
        teamName: selectedCompany.teamName,
        period: currentPeriod.period,
        payrollType,
        periodKey: currentPeriod.periodKey,
        employeeCount: employeePreview.length,
        grossTotal: roundMoney(previewTotals.grossTotal),
        employeeDeductionsTotal: roundMoney(previewTotals.employeeDeductionsTotal),
        employerChargesTotal: roundMoney(previewTotals.employerChargesTotal),
        netPayTotal: roundMoney(previewTotals.netPayTotal),
        employeeBreakdown: employeePreview,
        status: 'generated',
        createdAt: serverTimestamp(),
      });

      toast.success('Planilla generada', 'Se generó la planilla base con deducciones y costo patronal estimado.');
      await loadData();
    } catch (error) {
      console.error('Error generando planilla:', error);
      toast.error('No se pudo generar la planilla', 'Verifica las reglas y vuelve a intentarlo.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppShell
      title="Planilla"
      subtitle="Genera, revisa y compara planillas base para las empresas simuladas."
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <p className="text-sm text-slate-600 dark:text-slate-400">Planillas generadas</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--app-fg)]">{summary.totalRuns}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <p className="text-sm text-slate-600 dark:text-slate-400">Empresas con planilla</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--app-fg)]">{summary.companiesWithPayroll}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <p className="text-sm text-slate-600 dark:text-slate-400">Tipo activo</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--app-fg)]">{getPayrollTypeLabel(payrollType)}</p>
          </div>
          <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
            <p className="text-sm text-slate-600 dark:text-slate-400">Neto acumulado</p>
            <p className="mt-2 text-xl font-semibold text-[var(--app-fg)]">{formatCurrency(summary.totalNetPayroll)}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Generar planilla</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Ahora la planilla muestra bruto, deducción estimada del colaborador, costo patronal y neto a pagar.
            </p>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Empresa</label>
                <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                  <option value="">Selecciona una empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.tradeName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de planilla</label>
                <select value={payrollType} onChange={(event) => setPayrollType(event.target.value as PayrollType)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                  <option value="monthly">Mensual</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="weekly">Semanal</option>
                  <option value="daily">Diaria</option>
                </select>
              </div>

              {(payrollType === 'monthly' || payrollType === 'biweekly') ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Mes</label>
                  <input type="month" value={monthlyPeriod} onChange={(event) => setMonthlyPeriod(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition" />
                </div>
              ) : null}

              {payrollType === 'biweekly' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Quincena</label>
                  <select value={biweeklyPart} onChange={(event) => setBiweeklyPart(event.target.value as '1' | '2')} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                    <option value="1">Primera quincena</option>
                    <option value="2">Segunda quincena</option>
                  </select>
                </div>
              ) : null}

              {payrollType === 'weekly' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha base de semana</label>
                  <input type="date" value={weeklyDate} onChange={(event) => setWeeklyDate(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition" />
                </div>
              ) : null}

              {payrollType === 'daily' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Día</label>
                  <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition" />
                </div>
              ) : null}

              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                {selectedCompany
                  ? `${selectedCompany.tradeName} · ${currentPeriod.period} · ${employeePreview.length} empleado(s) activo(s)`
                  : 'Selecciona una empresa para calcular la planilla.'}
              </div>

              {duplicateRun ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                  Ya existe una planilla {getPayrollTypeLabel(payrollType).toLowerCase()} para esta empresa y período.
                </div>
              ) : null}

              <button type="button" onClick={() => void handleGeneratePayroll()} disabled={isGenerating || Boolean(duplicateRun)} className={positiveActionButtonClass}>
                {isGenerating ? 'Generando...' : 'Generar planilla'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Vista previa de planilla</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Revisa el detalle base antes de generarla. Este bloque también sirve como referencia para estudiantes.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[30rem] lg:grid-cols-[minmax(15rem,18rem)_minmax(13rem,16rem)]">
                <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} className="w-full min-w-0 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                  <option value="all">Todas las empresas</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.tradeName}</option>
                  ))}
                </select>

                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | PayrollType)} className="w-full min-w-0 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition">
                  <option value="all">Todos los tipos</option>
                  <option value="monthly">Mensual</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="weekly">Semanal</option>
                  <option value="daily">Diaria</option>
                </select>
              </div>
            </header>

            {selectedCompany ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Total bruto</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(previewTotals.grossTotal)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Deducciones</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(previewTotals.employeeDeductionsTotal)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Cargas patronales</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(previewTotals.employerChargesTotal)}</p></div>
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Neto a pagar</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(previewTotals.netPayTotal)}</p></div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                  <div className="max-h-[24rem] overflow-auto">
                    <table className="w-full min-w-[720px] border-collapse">
                      <thead className="bg-[var(--app-surface-muted)]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Colaborador</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Puesto</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Bruto</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Deducciones</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Cargas patronales</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeePreview.map((employee) => (
                          <tr key={employee.employeeId} className="border-t border-[color:var(--app-border)] bg-[var(--app-surface)]">
                            <td className="px-4 py-3 text-sm font-medium text-[var(--app-fg)]">{employee.fullName}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{employee.position}</td>
                            <td className="px-4 py-3 text-right text-sm text-[var(--app-fg)]">{formatCurrency(employee.salary)}</td>
                            <td className="px-4 py-3 text-right text-sm text-[var(--app-fg)]">{formatCurrency(employee.employeeDeductions)}</td>
                            <td className="px-4 py-3 text-right text-sm text-[var(--app-fg)]">{formatCurrency(employee.employerCharges)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(employee.netPay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
                Selecciona una empresa para revisar el cálculo base y validar los colaboradores que entrarán en planilla.
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-base font-semibold text-[var(--app-fg)]">Historial de planillas</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Consulta rápida de períodos generados, útil para seguimiento docente y comparación entre equipos.
              </p>

              {isLoading ? (
                <div className="mt-4 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Cargando planillas...</div>
              ) : filteredRuns.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">Todavía no hay planillas generadas.</div>
              ) : (
                <div className="mt-4 max-h-[34rem] space-y-4 overflow-y-auto pr-1">
                  {filteredRuns.map((run) => (
                    <article key={run.id} className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--app-fg)]">{run.companyName}</h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{run.period}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{run.teamName}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={neutralActionButtonClass}>{getPayrollTypeLabel(run.payrollType)}</span>
                          <span className={neutralActionButtonClass}>Generada</span>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Empleados</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{run.employeeCount}</p></div>
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Bruto</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{formatCurrency(run.grossTotal)}</p></div>
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Deducciones</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{formatCurrency(run.employeeDeductionsTotal)}</p></div>
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Cargas patronales</p><p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">{formatCurrency(run.employerChargesTotal)}</p></div>
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4"><p className="text-xs text-slate-500 dark:text-slate-400">Neto</p><p className="mt-1.5 text-sm font-semibold text-[var(--app-fg)]">{formatCurrency(run.netPayTotal)}</p></div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
