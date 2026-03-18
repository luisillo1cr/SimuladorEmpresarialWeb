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
import { toast } from '../utils/toast';
import {
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';


type DashboardPageProps = {
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

type StudentProfileDetails = {
  jobTitle: StudentJobTitle;
};

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
    legalRepresentative: string;
    registrationStatus: 'pending' | 'in_review' | 'registered';
    taxRegistrationStatus: 'pending' | 'active';
    municipalPatentStatus: 'pending' | 'active' | 'not_required';
  };
};

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
  status: 'draft' | 'closed';
};

type StaffSummary = {
  totalUsers: number;
  totalStudents: number;
  activeStudents: number;
  totalTeams: number;
  totalCompanies: number;
  totalOperations: number;
};

type InsightCard = {
  title: string;
  value: string;
  description: string;
  valueClassName?: string;
};

type CompactMetricCardProps = {
  title: string;
  value: string;
  helpText: string;
  valueClassName?: string;
};

type AlertTone = 'danger' | 'warning' | 'info';

type AlertItem = {
  text: string;
  tone: AlertTone;
};

type SignalTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type TrafficSignalCard = {
  title: string;
  status: string;
  description: string;
  tone: SignalTone;
};

type TrafficLightCardProps = TrafficSignalCard;

type PeriodComparisonChartProps = {
  operation: MonthlyOperationRecord | null;
};


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

function getDefaultValueClassName() {
  return 'text-[var(--app-fg)]';
}

function getJobValueClassName(jobTitle: StudentJobTitle) {
  switch (jobTitle) {
    case 'general_manager':
      return 'text-violet-700 dark:text-violet-300';
    case 'finance':
      return 'text-sky-700 dark:text-sky-300';
    case 'sales':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'operations':
      return 'text-amber-700 dark:text-amber-300';
    case 'hr':
      return 'text-pink-700 dark:text-pink-300';
    case 'unassigned':
    default:
      return 'text-slate-700 dark:text-slate-200';
  }
}

function getNetResultValueClassName(value: number) {
  if (value > 0) {
    return 'text-emerald-700 dark:text-emerald-300';
  }

  if (value < 0) {
    return 'text-rose-700 dark:text-rose-300';
  }

  return 'text-slate-700 dark:text-slate-200';
}

function getAmountValueClassName(value: number) {
  if (value > 0) {
    return 'text-emerald-700 dark:text-emerald-300';
  }

  if (value < 0) {
    return 'text-rose-700 dark:text-rose-300';
  }

  return 'text-slate-700 dark:text-slate-200';
}

function getPeriodStatusValueClassName(
  operation: MonthlyOperationRecord | null
) {
  if (!operation) {
    return 'text-slate-700 dark:text-slate-200';
  }

  if (operation.status === 'closed') {
    return 'text-emerald-700 dark:text-emerald-300';
  }

  return 'text-sky-700 dark:text-sky-300';
}

function getRegistrationStatusValueClassName(
  status: CompanyRecord['formalRegistration']['registrationStatus']
) {
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

function getAlertStyles(tone: AlertTone) {
  switch (tone) {
    case 'danger':
      return {
        container:
          'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/25',
        indicator: 'bg-rose-500 dark:bg-rose-400',
        text: 'text-rose-900 dark:text-rose-200',
        badge:
          'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/30 dark:text-rose-300',
        label: 'Crítico',
      };
    case 'warning':
      return {
        container:
          'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/25',
        indicator: 'bg-amber-500 dark:bg-amber-400',
        text: 'text-amber-900 dark:text-amber-200',
        badge:
          'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300',
        label: 'Atención',
      };
    case 'info':
    default:
      return {
        container:
          'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/25',
        indicator: 'bg-sky-500 dark:bg-sky-400',
        text: 'text-sky-900 dark:text-sky-200',
        badge:
          'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/30 dark:text-sky-300',
        label: 'Info',
      };
  }
}

function getSignalStyles(tone: SignalTone) {
  switch (tone) {
    case 'success':
      return {
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        badge:
          'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/30 dark:text-emerald-300',
        card:
          'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/30 dark:bg-emerald-950/15',
      };
    case 'warning':
      return {
        dot: 'bg-amber-500 dark:bg-amber-400',
        badge:
          'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-300',
        card:
          'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/15',
      };
    case 'danger':
      return {
        dot: 'bg-rose-500 dark:bg-rose-400',
        badge:
          'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/30 dark:text-rose-300',
        card:
          'border-rose-200/70 bg-rose-50/60 dark:border-rose-900/30 dark:bg-rose-950/15',
      };
    case 'info':
      return {
        dot: 'bg-sky-500 dark:bg-sky-400',
        badge:
          'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/30 dark:text-sky-300',
        card:
          'border-sky-200/70 bg-sky-50/60 dark:border-sky-900/30 dark:bg-sky-950/15',
      };
    case 'neutral':
    default:
      return {
        dot: 'bg-slate-400 dark:bg-slate-500',
        badge:
          'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        card: 'border-[color:var(--app-border)] bg-[var(--app-surface-muted)]',
      };
  }
}

function CompactMetricCard({
  title,
  value,
  helpText,
  valueClassName,
}: CompactMetricCardProps) {
  return (
    <article className="flex h-full min-h-[158px] flex-col rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>

        <div className="group relative flex items-center">
          <button
            type="button"
            tabIndex={0}
            aria-label={`Información sobre ${title}`}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[11px] font-semibold text-slate-500 transition hover:border-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400 dark:hover:text-slate-200"
          >
            i
          </button>

          <div className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-left text-xs leading-5 text-slate-600 shadow-2xl group-hover:block group-focus-within:block dark:text-slate-300">
            {helpText}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center pt-4">
        <p
          className={[
            'w-full break-words text-center text-[clamp(1.75rem,2vw,2.2rem)] font-semibold leading-tight tracking-tight',
            valueClassName ?? getDefaultValueClassName(),
          ].join(' ')}
        >
          {value}
        </p>
      </div>
    </article>
  );
}

function TrafficLightCard({
  title,
  status,
  description,
  tone,
}: TrafficLightCardProps) {
  const styles = getSignalStyles(tone);

  return (
    <article
      className={['rounded-3xl border p-5 shadow-sm', styles.card].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>

        <div className="flex items-center gap-2">
          <span className={['h-3 w-3 rounded-full', styles.dot].join(' ')} />
          <span
            className={[
              'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium',
              styles.badge,
            ].join(' ')}
          >
            {status}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--app-fg)]">
        {description}
      </p>
    </article>
  );
}

function buildChartBarWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return '0%';
  }

  const rawPercentage = (value / maxValue) * 100;
  return `${Math.max(rawPercentage, 8)}%`;
}

function PeriodComparisonChart({ operation }: PeriodComparisonChartProps) {
  if (!operation) {
    return (
      <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
        <header>
          <h3 className="text-lg font-semibold">Mini gráfica del período</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Comparación visual rápida entre ingresos y gastos del último período.
          </p>
        </header>

        <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
            Todavía no hay un período registrado para mostrar la comparación visual.
          </p>
        </div>
      </section>
    );
  }

  const chartRows = [
    {
      label: 'Ingresos',
      value: operation.totalIncome,
      barClassName: 'bg-emerald-500 dark:bg-emerald-400',
      valueClassName: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Gastos',
      value: operation.totalExpenses,
      barClassName: 'bg-amber-500 dark:bg-amber-400',
      valueClassName: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Resultado',
      value: Math.abs(operation.netResult),
      barClassName:
        operation.netResult >= 0
          ? 'bg-sky-500 dark:bg-sky-400'
          : 'bg-rose-500 dark:bg-rose-400',
      valueClassName:
        operation.netResult >= 0
          ? 'text-sky-700 dark:text-sky-300'
          : 'text-rose-700 dark:text-rose-300',
      displayValue: formatCurrency(operation.netResult),
    },
  ];

  const maxValue = Math.max(
    operation.totalIncome,
    operation.totalExpenses,
    Math.abs(operation.netResult),
    1
  );

  return (
    <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Mini gráfica del período</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Comparación visual rápida entre ingresos, gastos y resultado del último período.
          </p>
        </div>

        <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {operation.periodLabel}
        </span>
      </header>

      <div className="mt-5 space-y-4">
        {chartRows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-[var(--app-fg)]">
                {row.label}
              </p>

              <p
                className={[
                  'text-sm font-semibold',
                  row.valueClassName,
                ].join(' ')}
              >
                {row.displayValue ?? formatCurrency(row.value)}
              </p>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={[
                  'h-full rounded-full transition-all duration-500',
                  row.barClassName,
                ].join(' ')}
                style={{
                  width: buildChartBarWidth(row.value, maxValue),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 2,
  }).format(value);
}

function getJobTitleLabel(jobTitle: StudentJobTitle) {
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

function getRegistrationStatusLabel(
  status: CompanyRecord['formalRegistration']['registrationStatus']
) {
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

function buildStudentAlerts(
  company: CompanyRecord | null,
  latestOperation: MonthlyOperationRecord | null,
  jobTitle: StudentJobTitle
): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (!company) {
    alerts.push({
      text: 'Tu equipo todavía no tiene una empresa registrada. Debes esperar la asignación del docente.',
      tone: 'info',
    });
    return alerts;
  }

  if (
    company.formalRegistration.registrationStatus !== 'registered' &&
    jobTitle === 'general_manager'
  ) {
    alerts.push({
      text: 'La empresa aún no está formalmente inscrita. Revisa el estado legal y da seguimiento al proceso.',
      tone: 'warning',
    });
  }

  if (!latestOperation) {
    alerts.push({
      text: 'Aún no existe operación mensual registrada para tu empresa. Este es un buen momento para iniciar el período.',
      tone: 'info',
    });
    return alerts;
  }

  if (latestOperation.netResult < 0) {
    alerts.push({
      text: 'La empresa presenta resultado negativo en el período actual. Hay que revisar ingresos, costos y decisiones del equipo.',
      tone: 'danger',
    });
  }

  if (latestOperation.totalExpenses > latestOperation.totalIncome) {
    alerts.push({
      text: 'Los gastos del período ya superan los ingresos. Esto reduce caja y puede afectar el cierre mensual.',
      tone: 'warning',
    });
  }

  if (
    latestOperation.status === 'draft' &&
    latestOperation.totalIncome === 0 &&
    latestOperation.totalExpenses === 0
  ) {
    alerts.push({
      text: 'El período sigue prácticamente vacío. Hace falta registrar operaciones para que el panel tenga sentido real.',
      tone: 'info',
    });
  }

  if (latestOperation.status === 'closed') {
    alerts.push({
      text: 'El período actual está cerrado. Ya no puede editarse como estudiante hasta que un docente lo reabra.',
      tone: 'info',
    });
  }

  if (jobTitle === 'finance' && latestOperation.simplifiedTax <= 0) {
    alerts.push({
      text: 'Todavía no hay impuesto simplificado registrado. Finanzas debería revisar ese dato antes del cierre.',
      tone: 'warning',
    });
  }

  if (jobTitle === 'sales' && latestOperation.salesIncome <= 0) {
    alerts.push({
      text: 'No hay ventas registradas en el período. El área comercial debe revisar si faltan ingresos por registrar.',
      tone: 'warning',
    });
  }

  if (jobTitle === 'operations' && latestOperation.operatingExpenses <= 0) {
    alerts.push({
      text: 'No hay gastos operativos registrados. Verifica si realmente no hubo movimiento o si faltan datos.',
      tone: 'warning',
    });
  }

  if (jobTitle === 'hr' && latestOperation.payrollExpenses <= 0) {
    alerts.push({
      text: 'No hay planilla básica registrada en el período. Revisa si ese dato hace falta para el trabajo del equipo.',
      tone: 'warning',
    });
  }

  return alerts.slice(0, 4);
}

function buildStudentTasks(
  company: CompanyRecord | null,
  latestOperation: MonthlyOperationRecord | null,
  jobTitle: StudentJobTitle
) {
  const tasks: string[] = [];

  if (!company) {
    tasks.push('Esperar asignación de empresa.');
    tasks.push('Confirmar equipo y puesto con el docente.');
    return tasks;
  }

  if (jobTitle === 'unassigned') {
    tasks.push('Solicitar al docente la asignación formal de un puesto.');
  }

  if (!latestOperation) {
    tasks.push('Abrir la operación mensual y registrar el primer período.');
    tasks.push('Confirmar caja inicial e ingresos base del negocio.');
    return tasks;
  }

  switch (jobTitle) {
    case 'general_manager':
      tasks.push('Revisar el resultado neto del período.');
      tasks.push('Verificar si la empresa ya puede cerrar el mes.');
      tasks.push('Dar seguimiento al estado de inscripción formal.');
      break;
    case 'finance':
      tasks.push('Validar caja inicial, caja final e impuesto simplificado.');
      tasks.push('Revisar si los gastos superan los ingresos.');
      tasks.push('Confirmar que el período financiero esté listo para cierre.');
      break;
    case 'sales':
      tasks.push('Registrar correctamente ingresos por ventas y servicios.');
      tasks.push('Verificar si el ingreso comercial alcanza la meta del período.');
      tasks.push('Coordinar con gerencia si el resultado sigue bajo.');
      break;
    case 'operations':
      tasks.push('Revisar gastos operativos, alquiler y servicios.');
      tasks.push('Buscar oportunidades de ahorro sin frenar la operación.');
      tasks.push('Confirmar que los costos estén correctamente registrados.');
      break;
    case 'hr':
      tasks.push('Revisar la planilla básica registrada.');
      tasks.push('Confirmar que el equipo tenga sus datos operativos al día.');
      tasks.push('Informar a gerencia si la carga del período se desbalancea.');
      break;
    case 'unassigned':
    default:
      tasks.push('Revisar ingresos, gastos y estado del período.');
      tasks.push('Consultar con el docente cuál será tu responsabilidad principal.');
      break;
  }

  return tasks.slice(0, 3);
}

function buildJobMetrics(
  jobTitle: StudentJobTitle,
  company: CompanyRecord | null,
  latestOperation: MonthlyOperationRecord | null
): InsightCard[] {
  if (!company || !latestOperation) {
    return [
      {
        title: 'Puesto actual',
        value: getJobTitleLabel(jobTitle),
        description:
          'Tu panel se personalizará mejor cuando exista empresa y período activo.',
        valueClassName: getJobValueClassName(jobTitle),
      },
      {
        title: 'Empresa',
        value: company ? company.tradeName : 'Pendiente',
        description:
          'Tu empresa aparecerá aquí cuando el equipo quede completamente configurado.',
        valueClassName: getDefaultValueClassName(),
      },
    ];
  }

  switch (jobTitle) {
    case 'general_manager':
      return [
        {
          title: 'Resultado neto',
          value: formatCurrency(latestOperation.netResult),
          description:
            'Mide si la empresa terminó el período con ganancia o pérdida.',
          valueClassName: getNetResultValueClassName(latestOperation.netResult),
        },
        {
          title: 'Caja final',
          value: formatCurrency(latestOperation.closingCash),
          description:
            'Te ayuda a ver cuánto dinero queda disponible al final del período.',
          valueClassName: getAmountValueClassName(latestOperation.closingCash),
        },
        {
          title: 'Estado legal',
          value: getRegistrationStatusLabel(
            company.formalRegistration.registrationStatus
          ),
          description:
            'Indica qué tan avanzada está la empresa en su proceso formal.',
          valueClassName: getRegistrationStatusValueClassName(
            company.formalRegistration.registrationStatus
          ),
        },
      ];
    case 'finance':
      return [
        {
          title: 'Caja inicial',
          value: formatCurrency(latestOperation.openingCash),
          description: 'Dinero disponible al inicio del período.',
          valueClassName: getAmountValueClassName(latestOperation.openingCash),
        },
        {
          title: 'Gastos totales',
          value: formatCurrency(latestOperation.totalExpenses),
          description:
            'Suma de costos operativos, planilla, servicios e impuesto.',
          valueClassName:
            latestOperation.totalExpenses > 0
              ? 'text-amber-700 dark:text-amber-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Impuesto simplificado',
          value: formatCurrency(latestOperation.simplifiedTax),
          description: 'Carga tributaria resumida para esta simulación.',
          valueClassName:
            latestOperation.simplifiedTax > 0
              ? 'text-sky-700 dark:text-sky-300'
              : getDefaultValueClassName(),
        },
      ];
    case 'sales':
      return [
        {
          title: 'Ventas registradas',
          value: formatCurrency(latestOperation.salesIncome),
          description:
            'Ingresos directamente asociados a ventas de productos.',
          valueClassName:
            latestOperation.salesIncome > 0
              ? 'text-emerald-700 dark:text-emerald-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Servicios registrados',
          value: formatCurrency(latestOperation.serviceIncome),
          description:
            'Ingresos generados por trabajos o servicios brindados.',
          valueClassName:
            latestOperation.serviceIncome > 0
              ? 'text-sky-700 dark:text-sky-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Ingreso total',
          value: formatCurrency(latestOperation.totalIncome),
          description: 'Suma total de ingresos del período.',
          valueClassName:
            latestOperation.totalIncome > 0
              ? 'text-emerald-700 dark:text-emerald-300'
              : getDefaultValueClassName(),
        },
      ];
    case 'operations':
      return [
        {
          title: 'Gasto operativo',
          value: formatCurrency(latestOperation.operatingExpenses),
          description: 'Costo del funcionamiento diario del negocio.',
          valueClassName:
            latestOperation.operatingExpenses > 0
              ? 'text-amber-700 dark:text-amber-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Alquiler y servicios',
          value: formatCurrency(latestOperation.rentUtilitiesExpenses),
          description:
            'Pagos básicos para mantener la empresa operando.',
          valueClassName:
            latestOperation.rentUtilitiesExpenses > 0
              ? 'text-sky-700 dark:text-sky-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Costo total',
          value: formatCurrency(latestOperation.totalExpenses),
          description: 'Vista rápida del peso operativo del período.',
          valueClassName:
            latestOperation.totalExpenses > 0
              ? 'text-amber-700 dark:text-amber-300'
              : getDefaultValueClassName(),
        },
      ];
    case 'hr':
      return [
        {
          title: 'Planilla básica',
          value: formatCurrency(latestOperation.payrollExpenses),
          description:
            'Monto destinado al personal en esta simulación.',
          valueClassName:
            latestOperation.payrollExpenses > 0
              ? 'text-pink-700 dark:text-pink-300'
              : getDefaultValueClassName(),
        },
        {
          title: 'Estado del período',
          value: latestOperation.status === 'closed' ? 'Cerrado' : 'Borrador',
          description:
            'Te ayuda a saber si aún hay trabajo pendiente antes del cierre.',
          valueClassName: getPeriodStatusValueClassName(latestOperation),
        },
        {
          title: 'Equipo',
          value: company.teamName,
          description:
            'Referencia directa del equipo al que das soporte operativo.',
          valueClassName: getDefaultValueClassName(),
        },
      ];
    case 'unassigned':
    default:
      return [
        {
          title: 'Empresa',
          value: company.tradeName,
          description: 'Tu empresa actual dentro del simulador.',
          valueClassName: getDefaultValueClassName(),
        },
        {
          title: 'Resultado neto',
          value: formatCurrency(latestOperation.netResult),
          description: 'Resumen del desempeño económico del período.',
          valueClassName: getNetResultValueClassName(latestOperation.netResult),
        },
        {
          title: 'Estado del período',
          value: latestOperation.status === 'closed' ? 'Cerrado' : 'Borrador',
          description:
            'Indica si el período sigue editable o ya fue finalizado.',
          valueClassName: getPeriodStatusValueClassName(latestOperation),
        },
      ];
  }
}

function buildExecutiveSummary(
  company: CompanyRecord | null,
  latestOperation: MonthlyOperationRecord | null,
  jobTitle: StudentJobTitle
) {
  if (!company) {
    return {
      title: 'Configuración pendiente',
      description:
        'Todavía no tienes una empresa activa asignada. Cuando el docente complete la configuración del equipo, este panel mostrará información operativa más útil.',
      tone: 'info' as AlertTone,
    };
  }

  if (!latestOperation) {
    return {
      title: 'Período listo para iniciar',
      description:
        'Tu empresa ya existe, pero aún no hay operación mensual registrada. El siguiente paso recomendado es abrir el período y comenzar a registrar movimientos.',
      tone: 'info' as AlertTone,
    };
  }

  if (latestOperation.netResult < 0) {
    return {
      title: 'Resultado negativo detectado',
      description:
        'La empresa está operando con pérdida en el período actual. Conviene revisar ingresos, costos y decisiones del área responsable.',
      tone: 'danger' as AlertTone,
    };
  }

  if (
    jobTitle === 'general_manager' &&
    company.formalRegistration.registrationStatus !== 'registered'
  ) {
    return {
      title: 'Seguimiento legal requerido',
      description:
        'La empresa todavía no completa su estado formal. Como gerencia, vale la pena mantener ese punto visible para el equipo.',
      tone: 'warning' as AlertTone,
    };
  }

  if (latestOperation.status === 'closed') {
    return {
      title: 'Período cerrado',
      description:
        'El período actual ya fue finalizado. Ahora la prioridad es revisar el resultado y preparar el siguiente ciclo operativo.',
      tone: 'info' as AlertTone,
    };
  }

  return {
    title: 'Operación en marcha',
    description:
      'La empresa ya tiene actividad registrada y el período sigue abierto. Sigue alimentando datos útiles para que el análisis sea cada vez más real.',
    tone: 'info' as AlertTone,
  };
}

function buildBusinessTrafficLights(
  company: CompanyRecord | null,
  latestOperation: MonthlyOperationRecord | null
): TrafficSignalCard[] {
  const legalStatus =
    company?.formalRegistration.registrationStatus ?? 'pending';

  const legalCard: TrafficSignalCard = {
    title: 'Estado legal',
    status:
      legalStatus === 'registered'
        ? 'Estable'
        : legalStatus === 'in_review'
          ? 'Seguimiento'
          : 'Pendiente',
    description:
      legalStatus === 'registered'
        ? 'La empresa ya figura con un nivel formal aceptable dentro de la simulación.'
        : legalStatus === 'in_review'
          ? 'El estado legal va avanzando, pero todavía requiere revisión o seguimiento.'
          : 'La empresa aún no completa su estado formal. Conviene mantener este punto visible.',
    tone:
      legalStatus === 'registered'
        ? 'success'
        : legalStatus === 'in_review'
          ? 'warning'
          : 'neutral',
  };

  if (!latestOperation) {
    return [
      {
        title: 'Caja',
        status: 'Sin datos',
        description:
          'Todavía no existe operación mensual registrada, así que no hay caja final para evaluar.',
        tone: 'neutral',
      },
      {
        title: 'Resultado',
        status: 'Sin datos',
        description:
          'Aún no se puede determinar desempeño económico porque el período no ha iniciado.',
        tone: 'neutral',
      },
      legalCard,
      {
        title: 'Período',
        status: 'Sin iniciar',
        description:
          'El equipo todavía no ha abierto la operación mensual de la empresa.',
        tone: 'neutral',
      },
    ];
  }

  const cashTone: SignalTone =
    latestOperation.closingCash > 0
      ? 'success'
      : latestOperation.closingCash === 0
        ? 'warning'
        : 'danger';

  const resultTone: SignalTone =
    latestOperation.netResult > 0
      ? 'success'
      : latestOperation.netResult === 0
        ? 'warning'
        : 'danger';

  const periodTone: SignalTone =
    latestOperation.status === 'closed' ? 'success' : 'info';

  return [
    {
      title: 'Caja',
      status:
        latestOperation.closingCash > 0
          ? 'Saludable'
          : latestOperation.closingCash === 0
            ? 'Ajustada'
            : 'Crítica',
      description:
        latestOperation.closingCash > 0
          ? 'La empresa conserva caja positiva al cierre del período.'
          : latestOperation.closingCash === 0
            ? 'La caja quedó en el límite. Conviene vigilar los próximos movimientos.'
            : 'La caja final quedó negativa. Hace falta revisar ingresos y gastos con urgencia.',
      tone: cashTone,
    },
    {
      title: 'Resultado',
      status:
        latestOperation.netResult > 0
          ? 'Positivo'
          : latestOperation.netResult === 0
            ? 'Neutral'
            : 'Negativo',
      description:
        latestOperation.netResult > 0
          ? 'El período cierra con ganancia y refleja desempeño favorable.'
          : latestOperation.netResult === 0
            ? 'El período está equilibrado, pero sin margen claro de mejora.'
            : 'El período registra pérdida y requiere análisis del equipo.',
      tone: resultTone,
    },
    legalCard,
    {
      title: 'Período',
      status: latestOperation.status === 'closed' ? 'Cerrado' : 'En curso',
      description:
        latestOperation.status === 'closed'
          ? 'El período ya fue finalizado y no debería seguir cambiando sin revisión.'
          : 'El período sigue abierto y aún puede enriquecerse con más datos.',
      tone: periodTone,
    },
  ];
}

export function DashboardPage({
  isDarkMode,
  onToggleTheme,
}: DashboardPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);

  const [studentDetails, setStudentDetails] = useState<StudentProfileDetails>({
    jobTitle: 'unassigned',
  });
  const [studentCompany, setStudentCompany] = useState<CompanyRecord | null>(null);
  const [studentLatestOperation, setStudentLatestOperation] =
    useState<MonthlyOperationRecord | null>(null);

  const [staffSummary, setStaffSummary] = useState<StaffSummary>({
    totalUsers: 0,
    totalStudents: 0,
    activeStudents: 0,
    totalTeams: 0,
    totalCompanies: 0,
    totalOperations: 0,
  });

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!profile) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        if (profile.role === 'student') {
          const userRef = doc(db, 'users', profile.uid);
          const userSnapshot = await getDoc(userRef);

          const rawJobTitle = userSnapshot.exists()
            ? userSnapshot.data().jobTitle
            : null;

          const normalizedJobTitle: StudentJobTitle = isValidStudentJobTitle(
            rawJobTitle
          )
            ? rawJobTitle
            : 'unassigned';

          const resolvedTeamId = userSnapshot.exists()
            ? (userSnapshot.data().teamId ?? null)
            : null;

          setStudentDetails({
            jobTitle: normalizedJobTitle,
          });

          if (!resolvedTeamId) {
            setStudentCompany(null);
            setStudentLatestOperation(null);
            return;
          }

          const companiesRef = collection(db, 'companies');
          const companiesQuery = query(
            companiesRef,
            where('teamId', '==', resolvedTeamId)
          );
          const companiesSnapshot = await getDocs(companiesQuery);

          if (companiesSnapshot.empty) {
            setStudentCompany(null);
            setStudentLatestOperation(null);
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
              legalRepresentative:
                companyData.formalRegistration?.legalRepresentative ?? '',
              registrationStatus:
                companyData.formalRegistration?.registrationStatus === 'registered'
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
            },
          };

          setStudentCompany(nextCompany);

          const operationsRef = collection(db, 'monthlyOperations');
          const operationsQuery = query(
            operationsRef,
            where('teamId', '==', resolvedTeamId)
          );
          const operationsSnapshot = await getDocs(operationsQuery);

          const nextOperations = operationsSnapshot.docs
            .map<MonthlyOperationRecord>((document) => {
              const data = document.data();

              return {
                id: document.id,
                companyId: String(data.companyId ?? ''),
                teamId: String(data.teamId ?? ''),
                periodYear: Number(data.periodYear ?? 0),
                periodMonth: Number(data.periodMonth ?? 0),
                periodLabel: String(data.periodLabel ?? ''),
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

          setStudentLatestOperation(nextOperations[0] ?? null);
        } else {
          const [usersSnapshot, teamsSnapshot, companiesSnapshot, operationsSnapshot] =
            await Promise.all([
              getDocs(collection(db, 'users')),
              getDocs(collection(db, 'teams')),
              getDocs(collection(db, 'companies')),
              getDocs(collection(db, 'monthlyOperations')),
            ]);

          const allUsers = usersSnapshot.docs.map((document) => document.data());

          setStaffSummary({
            totalUsers: usersSnapshot.size,
            totalStudents: allUsers.filter((user) => user.role === 'student').length,
            activeStudents: allUsers.filter(
              (user) => user.role === 'student' && user.status === 'active'
            ).length,
            totalTeams: teamsSnapshot.size,
            totalCompanies: companiesSnapshot.size,
            totalOperations: operationsSnapshot.size,
          });
        }
      } catch (error) {
        console.error('Error cargando dashboard:', error);
        toast.error(
          'No se pudo cargar el dashboard',
          'Verifica las reglas y vuelve a intentarlo.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboard();
  }, [profile]);

  const studentAlerts = useMemo(() => {
    return buildStudentAlerts(
      studentCompany,
      studentLatestOperation,
      studentDetails.jobTitle
    );
  }, [studentCompany, studentLatestOperation, studentDetails.jobTitle]);

  const studentTasks = useMemo(() => {
    return buildStudentTasks(
      studentCompany,
      studentLatestOperation,
      studentDetails.jobTitle
    );
  }, [studentCompany, studentLatestOperation, studentDetails.jobTitle]);

  const studentJobMetrics = useMemo(() => {
    return buildJobMetrics(
      studentDetails.jobTitle,
      studentCompany,
      studentLatestOperation
    );
  }, [studentDetails.jobTitle, studentCompany, studentLatestOperation]);

  const studentJobMetricsGridClass = useMemo(() => {
    if (studentJobMetrics.length <= 2) {
      return 'grid gap-4 md:grid-cols-2 xl:grid-cols-2';
    }

    if (studentJobMetrics.length === 3) {
      return 'grid gap-4 md:grid-cols-2 xl:grid-cols-3';
    }

    return 'grid gap-4 md:grid-cols-2 xl:grid-cols-4';
  }, [studentJobMetrics.length]);

  const executiveSummary = useMemo(() => {
    return buildExecutiveSummary(
      studentCompany,
      studentLatestOperation,
      studentDetails.jobTitle
    );
  }, [studentCompany, studentLatestOperation, studentDetails.jobTitle]);

  const executiveSummaryStyles = useMemo(() => {
    return getAlertStyles(executiveSummary.tone);
  }, [executiveSummary]);

  const businessTrafficLights = useMemo(() => {
    return buildBusinessTrafficLights(studentCompany, studentLatestOperation);
  }, [studentCompany, studentLatestOperation]);

  return (
    <AppShell
      title="Dashboard"
      subtitle={
        profile?.role === 'student'
          ? 'Resumen operativo adaptado a tu empresa y tu puesto.'
          : 'Vista general de usuarios, equipos, empresas y operaciones.'
      }
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      onLogout={handleLogout}
      onOpenProfile={handleOpenProfile}
    >
      {isLoading ? (
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
            Cargando dashboard...
          </div>
        </section>
      ) : profile?.role === 'student' ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Vista personalizada del estudiante
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  {studentCompany?.tradeName ?? 'Empresa pendiente'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Este panel cambia según tu puesto de trabajo dentro del equipo
                  y te muestra lo más importante para tomar decisiones útiles.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/my-company')}
                  className={neutralActionButtonClass}
                >
                  Ver mi empresa
                </button>

                <button
                  type="button"
                  onClick={() =>
                    studentCompany
                      ? navigate(`/company-operations/${studentCompany.id}`)
                      : navigate('/my-company')
                  }
                  className={positiveActionButtonClass}
                >
                  Abrir operación mensual
                </button>
              </div>
            </div>
          </section>

          <section
            className={[
              'rounded-3xl border p-5 shadow-sm',
              executiveSummaryStyles.container,
            ].join(' ')}
          >
            <div className="flex items-start gap-4">
              <div
                className={[
                  'mt-1 h-3 w-3 shrink-0 rounded-full',
                  executiveSummaryStyles.indicator,
                ].join(' ')}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3
                    className={[
                      'text-base font-semibold',
                      executiveSummaryStyles.text,
                    ].join(' ')}
                  >
                    {executiveSummary.title}
                  </h3>

                  <span
                    className={[
                      'inline-flex rounded-full border px-2.5 py-1 text-xs font-medium',
                      executiveSummaryStyles.badge,
                    ].join(' ')}
                  >
                    {executiveSummaryStyles.label}
                  </span>
                </div>

                <p
                  className={[
                    'mt-2 text-sm leading-6',
                    executiveSummaryStyles.text,
                  ].join(' ')}
                >
                  {executiveSummary.description}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <CompactMetricCard
              title="Puesto"
              value={getJobTitleLabel(studentDetails.jobTitle)}
              helpText="Tu puesto define qué métricas, alertas y prioridades ves en este dashboard. Si aparece sin asignar, el docente todavía no te ha asignado una responsabilidad específica."
              valueClassName={getJobValueClassName(studentDetails.jobTitle)}
            />

            <CompactMetricCard
              title="Equipo"
              value={studentCompany?.teamName ?? 'Sin asignar'}
              helpText="Este es el equipo de trabajo al que perteneces dentro del simulador. La empresa y la operación mensual dependen de esta asignación."
              valueClassName={getDefaultValueClassName()}
            />

            <CompactMetricCard
              title="Estado del período"
              value={
                studentLatestOperation
                  ? studentLatestOperation.status === 'closed'
                    ? 'Cerrado'
                    : 'Borrador'
                  : 'Sin iniciar'
              }
              helpText="Indica si el período mensual ya fue iniciado y en qué estado está. Borrador significa que sigue editable. Cerrado significa que ya fue finalizado."
              valueClassName={getPeriodStatusValueClassName(
                studentLatestOperation
              )}
            />

            <CompactMetricCard
              title="Resultado neto"
              value={
                studentLatestOperation
                  ? formatCurrency(studentLatestOperation.netResult)
                  : formatCurrency(0)
              }
              helpText="Este es el balance económico más importante del período. Se calcula restando los gastos totales a los ingresos totales."
              valueClassName={getNetResultValueClassName(
                studentLatestOperation?.netResult ?? 0
              )}
            />
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header>
              <h3 className="text-lg font-semibold">Semáforo empresarial</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Lectura rápida del estado actual de la empresa para decidir qué
                necesita atención primero.
              </p>
            </header>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {businessTrafficLights.map((item) => (
                <TrafficLightCard
                  key={item.title}
                  title={item.title}
                  status={item.status}
                  description={item.description}
                  tone={item.tone}
                />
              ))}
            </div>
          </section>

          <PeriodComparisonChart operation={studentLatestOperation} />

          <section className={studentJobMetricsGridClass}>
            {studentJobMetrics.map((metric) => (
              <CompactMetricCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                helpText={metric.description}
                valueClassName={metric.valueClassName}
              />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Alertas e insights</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Lectura rápida de lo que merece atención inmediata.
                </p>
              </header>

              <div className="mt-5 space-y-3">
                {studentAlerts.length > 0 ? (
                  studentAlerts.map((alert, index) => {
                    const styles = getAlertStyles(alert.tone);

                    return (
                      <div
                        key={`${alert.text}-${index}`}
                        className={[
                          'rounded-2xl border px-4 py-4',
                          styles.container,
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={[
                              'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                              styles.indicator,
                            ].join(' ')}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="mb-2">
                              <span
                                className={[
                                  'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium',
                                  styles.badge,
                                ].join(' ')}
                              >
                                {styles.label}
                              </span>
                            </div>

                            <p
                              className={[
                                'text-sm leading-6',
                                styles.text,
                              ].join(' ')}
                            >
                              {alert.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                    <p className="text-sm leading-6 text-[var(--app-fg)]">
                      No hay alertas críticas por ahora. Sigue alimentando la
                      operación mensual con datos reales del ejercicio.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Prioridades de tu puesto</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Sugerencias prácticas para trabajar mejor este período.
                </p>
              </header>

              <div className="mt-5 space-y-3">
                {studentTasks.map((task, index) => (
                  <div
                    key={`${task}-${index}`}
                    className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {index + 1}
                      </div>

                      <p className="text-sm leading-6 text-[var(--app-fg)]">
                        {task}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Contexto de la empresa</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Información general para entender mejor dónde estás trabajando.
                </p>
              </header>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nombre legal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {studentCompany?.businessName ?? 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Industria
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {studentCompany?.industry ?? 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cédula jurídica
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {studentCompany?.legalId ?? 'Sin definir'}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Inscripción formal
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-fg)]">
                    {studentCompany
                      ? getRegistrationStatusLabel(
                          studentCompany.formalRegistration.registrationStatus
                        )
                      : 'Pendiente'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Acciones rápidas</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Accede rápido a los módulos que más usarás.
                </p>
              </header>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/my-company')}
                  className={neutralActionButtonClass}
                >
                  Ir a mi empresa
                </button>

                <button
                  type="button"
                  onClick={() =>
                    studentCompany
                      ? navigate(`/company-operations/${studentCompany.id}`)
                      : navigate('/my-company')
                  }
                  className={positiveActionButtonClass}
                >
                  Ir a operación mensual
                </button>

                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className={neutralActionButtonClass}
                >
                  Ver mi perfil
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Usuarios registrados
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">
                {staffSummary.totalUsers}
              </p>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estudiantes activos
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">
                {staffSummary.activeStudents}
              </p>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Equipos creados
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">
                {staffSummary.totalTeams}
              </p>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Empresas registradas
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">
                {staffSummary.totalCompanies}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Resumen administrativo</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Vista general del simulador para gestión académica y operativa.
                </p>
              </header>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Estudiantes registrados
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-[var(--app-fg)]">
                    {staffSummary.totalStudents}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Operaciones mensuales
                  </p>
                  <p className="mt-1.5 text-lg font-semibold text-[var(--app-fg)]">
                    {staffSummary.totalOperations}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 sm:col-span-2">
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold">Acciones rápidas</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Navega directo a los módulos administrativos clave.
                </p>
              </header>

              <div className="mt-5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/admin/users')}
                  className={neutralActionButtonClass}
                >
                  Gestionar usuarios
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/teams')}
                  className={neutralActionButtonClass}
                >
                  Gestionar equipos
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/admin/companies')}
                  className={positiveActionButtonClass}
                >
                  Gestionar empresas
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
