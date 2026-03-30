import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { AppShell } from '../components/layout/AppShell';
import { auth, db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile, UserRole, UserStatus } from '../types/auth';
import { getRoleLabel, getStatusLabel } from '../utils/authLabels';
import { normalizeEmail } from '../utils/email';
import { toast } from '../utils/toast';
import {
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';

type UsersPageProps = {
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

type UserProfileWithJob = UserProfile & {
  jobTitle?: StudentJobTitle | null;
};

const adminRoleOptions: UserRole[] = ['student', 'professor', 'admin'];

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

function getRoleBadgeClass(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300';
    case 'professor':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
    case 'student':
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
}

function getStatusBadgeClass(status: UserStatus) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'inactive':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    case 'invited':
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
  }
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

function getJobTitleBadgeClass(jobTitle: StudentJobTitle | null | undefined) {
  switch (jobTitle) {
    case 'general_manager':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-300';
    case 'finance':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300';
    case 'sales':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'operations':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300';
    case 'hr':
      return 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900/40 dark:bg-pink-950/40 dark:text-pink-300';
    case 'unassigned':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getInviteLinkBaseUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/complete-signin`;
}

export function UsersPage({
  isDarkMode,
  onToggleTheme,
}: UsersPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [users, setUsers] = useState<UserProfileWithJob[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [selectedUser, setSelectedUser] = useState<UserProfileWithJob | null>(null);
  const [formRole, setFormRole] = useState<UserRole>('student');
  const [formStatus, setFormStatus] = useState<UserStatus>('active');
  const [isSaving, setIsSaving] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const canCurrentUserEditRoles = useMemo(() => {
    return profile?.role === 'admin';
  }, [profile?.role]);

  const canCurrentUserInvite = useMemo(() => {
    return profile?.role === 'admin' || profile?.role === 'professor';
  }, [profile?.role]);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);

      const usersRef = collection(db, 'users');
      const usersQuery = query(usersRef, orderBy('firstName'));
      const snapshot = await getDocs(usersQuery);

      const nextUsers: UserProfileWithJob[] = snapshot.docs.map((document) => {
        const data = document.data();
        const normalizedRole: UserRole =
          data.role === 'admin' ||
          data.role === 'professor' ||
          data.role === 'student'
            ? data.role
            : 'student';

        const normalizedJobTitle: StudentJobTitle | null =
          normalizedRole === 'student'
            ? isValidStudentJobTitle(data.jobTitle)
              ? data.jobTitle
              : 'unassigned'
            : null;

        return {
          uid: document.id,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          role: normalizedRole,
          teamId: data.teamId ?? null,
          status:
            data.status === 'inactive' || data.status === 'invited'
              ? data.status
              : 'active',
          jobTitle: normalizedJobTitle,
        };
      });

      setUsers(nextUsers);
    } catch {
      toast.error(
        'No se pudieron cargar los usuarios',
        'Revisa las reglas de Firestore y la estructura de la colección users.'
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const canEditUser = (targetUser: UserProfileWithJob) => {
    if (!profile) {
      return false;
    }

    if (targetUser.uid === profile.uid) {
      return false;
    }

    if (profile.role === 'admin') {
      return true;
    }

    if (profile.role === 'professor') {
      return targetUser.role === 'student';
    }

    return false;
  };

  const handleOpenEdit = (targetUser: UserProfileWithJob) => {
    setSelectedUser(targetUser);
    setFormRole(targetUser.role);
    setFormStatus(targetUser.status);
  };

  const handleCloseEdit = () => {
    if (isSaving) {
      return;
    }

    setSelectedUser(null);
  };

  const handleSave = async () => {
    if (!selectedUser || !profile) {
      return;
    }

    const nextRole = profile.role === 'admin' ? formRole : selectedUser.role;
    const nextStatus = formStatus;
    const nextJobTitle = selectedUser.role === 'student' ? selectedUser.jobTitle ?? 'unassigned' : null;

    try {
      setIsSaving(true);

      const userRef = doc(db, 'users', selectedUser.uid);

      await updateDoc(userRef, {
        role: nextRole,
        status: nextStatus,
        jobTitle: nextJobTitle,
      });

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.uid === selectedUser.uid
            ? {
                ...user,
                role: nextRole,
                status: nextStatus,
                jobTitle: nextJobTitle,
              }
            : user
        )
      );

      toast.success(
        'Usuario actualizado',
        'Los cambios se guardaron correctamente.'
      );

      setSelectedUser(null);
    } catch {
      toast.error(
        'No se pudo actualizar el usuario',
        'Verifica tus permisos y vuelve a intentarlo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetInviteForm = () => {
    setInviteFirstName('');
    setInviteLastName('');
    setInviteEmail('');
  };

  const handleCloseInviteModal = () => {
    if (isInviting) {
      return;
    }

    setIsInviteModalOpen(false);
    resetInviteForm();
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      return;
    }

    const normalizedEmail = normalizeEmail(inviteEmail);

    if (!inviteFirstName.trim() || !inviteLastName.trim() || !normalizedEmail) {
      toast.warning(
        'Campos incompletos',
        'Debes ingresar nombre, apellido y correo electrónico.'
      );
      return;
    }

    try {
      setIsInviting(true);

      const existingUsersSnapshot = await getDocs(
        query(collection(db, 'users'), where('email', '==', normalizedEmail))
      );

      if (!existingUsersSnapshot.empty) {
        toast.warning(
          'Correo ya registrado',
          'Ya existe un usuario registrado con ese correo electrónico.'
        );
        return;
      }

      const inviteRef = doc(db, 'invites', normalizedEmail);

      await setDoc(
        inviteRef,
        {
          email: normalizedEmail,
          firstName: inviteFirstName.trim(),
          lastName: inviteLastName.trim(),
          invitedBy: profile.uid,
          role: 'student',
          status: 'invited',
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        { merge: true }
      );

      await sendSignInLinkToEmail(auth, normalizedEmail, {
        url: getInviteLinkBaseUrl(),
        handleCodeInApp: true,
      });

      toast.success(
        'Invitación enviada',
        'Se envió el enlace de activación al correo del estudiante.'
      );

      setIsInviteModalOpen(false);
      resetInviteForm();
      await loadUsers();
    } catch (error) {
      console.error('Error enviando invitación:', error);
      toast.error(
        'No se pudo enviar la invitación',
        'Revisa dominios autorizados, configuración de Auth y vuelve a intentarlo.'
      );
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <>
      <AppShell
        title="Usuarios"
        subtitle="Gestión de usuarios, roles y estado general de acceso."
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
        onOpenProfile={handleOpenProfile}
      >
        <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm sm:p-6">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Listado de usuarios</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Visualiza usuarios registrados, controla sus roles y administra el estado de acceso del sistema.
              </p>
            </div>

            {canCurrentUserInvite ? (
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className={`${positiveActionButtonClass} w-full sm:w-auto`}
              >
                Invitar estudiante
              </button>
            ) : null}
          </header>

          {isLoadingUsers ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              Cargando usuarios...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              No hay usuarios registrados todavía.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
              <div className="overflow-x-auto">
                <table className="w-max min-w-full border-collapse">
                  <thead className="bg-[var(--app-surface-muted)]">
                    <tr>
                      <th className="min-w-[220px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Nombre
                      </th>
                      <th className="min-w-[260px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Correo
                      </th>
                      <th className="min-w-[120px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Rol
                      </th>
                      <th className="min-w-[150px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Puesto
                      </th>
                      <th className="min-w-[120px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Estado
                      </th>
                      <th className="min-w-[160px] px-4 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Equipo
                      </th>
                      <th className="w-[140px] min-w-[140px] px-4 py-4 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Acción
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.uid}
                        className="border-t border-[color:var(--app-border)]"
                      >
                        <td className="px-4 py-4 text-sm text-[var(--app-fg)]">
                          <div className="truncate">{user.firstName} {user.lastName}</div>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="truncate">{user.email}</div>
                        </td>

                        <td className="px-4 py-4 text-sm">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                              getRoleBadgeClass(user.role),
                            ].join(' ')}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm">
                          {user.role === 'student' ? (
                            <span
                              className={[
                                'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                                getJobTitleBadgeClass(user.jobTitle),
                              ].join(' ')}
                            >
                              {getJobTitleLabel(user.jobTitle)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              No aplica
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-medium',
                              getStatusBadgeClass(user.status),
                            ].join(' ')}
                          >
                            {getStatusLabel(user.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="truncate">{user.teamId ?? 'Sin asignar'}</div>
                        </td>

                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          {canEditUser(user) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className={neutralActionButtonClass}
                            >
                              Editar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Sin acción
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </AppShell>

      {selectedUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <header className="mb-6">
              <h2 className="text-xl font-semibold">Editar usuario</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Actualiza rol y estado del usuario seleccionado. El puesto del estudiante ahora se gestiona desde la empresa asignada.
              </p>
            </header>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Nombre</p>
                <p className="mt-2 text-base font-medium">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
              </div>

              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Correo</p>
                <p className="mt-2 text-base font-medium">{selectedUser.email}</p>
              </div>

              <div>
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Rol
                </label>
                <select
                  id="role"
                  value={formRole}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setFormRole(event.target.value as UserRole)
                  }
                  disabled={!canCurrentUserEditRoles || isSaving}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adminRoleOptions.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {getRoleLabel(roleOption)}
                    </option>
                  ))}
                </select>

                {!canCurrentUserEditRoles ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Solo los administradores pueden modificar roles.
                  </p>
                ) : null}
              </div>

              {formRole === 'student' ? (
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Puesto del estudiante</p>
                  <p className="mt-2 text-base font-medium">
                    {getJobTitleLabel(selectedUser.jobTitle ?? 'unassigned')}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Este dato ahora se administra desde el detalle de la empresa para que el puesto siempre quede ligado al contexto del equipo.
                  </p>
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Estado
                </label>
                <select
                  id="status"
                  value={formStatus}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setFormStatus(event.target.value as UserStatus)
                  }
                  disabled={isSaving}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="invited">Invitado</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSaving}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={positiveActionButtonClass}
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isInviteModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
            <div className="border-b border-[color:var(--app-border)] px-6 py-5">
              <h2 className="text-xl font-semibold">Invitar estudiante</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Se creará una invitación y se enviará un enlace de activación al
                correo del estudiante.
              </p>
            </div>

            <form id="inviteStudentForm" onSubmit={handleInviteSubmit}>
              <div className="grid gap-4 px-6 py-6">
                <div>
                  <label
                    htmlFor="inviteFirstName"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Nombre
                  </label>
                  <input
                    id="inviteFirstName"
                    type="text"
                    value={inviteFirstName}
                    onChange={(event) => setInviteFirstName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inviteLastName"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Apellido
                  </label>
                  <input
                    id="inviteLastName"
                    type="text"
                    value={inviteLastName}
                    onChange={(event) => setInviteLastName(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inviteEmail"
                    className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                  />
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  El estudiante recibirá un correo con enlace de activación para
                  definir su contraseña y completar el ingreso inicial.
                </div>
              </div>
            </form>

            <div className="border-t border-[color:var(--app-border)] px-6 py-4">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseInviteModal}
                  disabled={isInviting}
                  className={neutralActionButtonClass}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  form="inviteStudentForm"
                  disabled={isInviting}
                  className={positiveActionButtonClass}
                >
                  {isInviting ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
