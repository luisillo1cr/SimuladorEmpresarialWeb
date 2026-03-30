import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AppShell } from '../components/layout/AppShell';
import { db } from '../services/firebase/config';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile } from '../types/auth';
import { toast } from '../utils/toast';
import {
  negativeActionButtonClass,
  neutralActionButtonClass,
  positiveActionButtonClass,
} from '../utils/buttonStyles';
import {
  getTeamInternalChatId,
  getTeamProfessorChatId,
} from '../services/chat/chatIds';

type TeamsPageProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

type TeamRecord = {
  id: string;
  name: string;
  memberIds: string[];
  memberNames: string[];
  createdAt?: unknown;
};

const STANDARD_TEAM_MEMBERS = 3;
const EXCEPTION_TEAM_MEMBERS = 4;

function buildMemberLabel(user: UserProfile) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function buildInternalChatTitle(teamName: string) {
  return `Equipo ${teamName}`;
}

function buildProfessorChatTitle(teamName: string) {
  return `Profesor · ${teamName}`;
}

export function TeamsPage({
  isDarkMode,
  onToggleTheme,
}: TeamsPageProps) {
  const navigate = useNavigate();
  const { profile, signOutUser } = useAuth();

  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState<'all' | 'standard' | 'exception' | 'incomplete'>('all');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState<TeamRecord | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editSelectedStudentIds, setEditSelectedStudentIds] = useState<
    string[]
  >([]);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);

  const [teamToDelete, setTeamToDelete] = useState<TeamRecord | null>(null);
  const [isDeletingTeam, setIsDeletingTeam] = useState(false);
  const [teamToExtend, setTeamToExtend] = useState<TeamRecord | null>(null);
  const [extensionStudentId, setExtensionStudentId] = useState('');
  const [isExtendingTeam, setIsExtendingTeam] = useState(false);

  const existingStudentIds = useMemo(() => {
    return new Set(students.map((student) => student.uid));
  }, [students]);

  const availableStudents = useMemo(() => {
    return students.filter(
      (student) => student.teamId == null && student.status === 'active'
    );
  }, [students]);

  const selectedStudents = useMemo(() => {
    return availableStudents.filter((student) =>
      selectedStudentIds.includes(student.uid)
    );
  }, [availableStudents, selectedStudentIds]);

  const editableStudents = useMemo(() => {
    if (!selectedTeam) {
      return [];
    }

    return students.filter(
      (student) =>
        student.teamId === selectedTeam.id ||
        (student.teamId == null && student.status === 'active')
    );
  }, [students, selectedTeam]);

  const editSelectedStudents = useMemo(() => {
    return editableStudents.filter((student) =>
      editSelectedStudentIds.includes(student.uid)
    );
  }, [editableStudents, editSelectedStudentIds]);

  const extensionCandidates = useMemo(() => {
    if (!teamToExtend) {
      return [];
    }

    return students.filter((student) => student.teamId == null && student.status === 'active');
  }, [students, teamToExtend]);

  const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        team.name.toLowerCase().includes(normalizedSearchTerm) ||
        team.memberNames.some((memberName) =>
          memberName.toLowerCase().includes(normalizedSearchTerm)
        );

      if (!matchesSearch) {
        return false;
      }

      if (teamFilter === 'standard') {
        return team.memberIds.length >= 1 && team.memberIds.length <= STANDARD_TEAM_MEMBERS;
      }

      if (teamFilter === 'exception') {
        return team.memberIds.length === EXCEPTION_TEAM_MEMBERS;
      }

      if (teamFilter === 'incomplete') {
        return team.memberIds.length < STANDARD_TEAM_MEMBERS;
      }

      return true;
    });
  }, [normalizedSearchTerm, teamFilter, teams]);

  const teamsSummary = useMemo(() => {
    const standardTeams = teams.filter(
      (team) => team.memberIds.length >= 1 && team.memberIds.length <= STANDARD_TEAM_MEMBERS
    ).length;
    const exceptionTeams = teams.filter(
      (team) => team.memberIds.length === EXCEPTION_TEAM_MEMBERS
    ).length;
    const incompleteTeams = teams.filter(
      (team) => team.memberIds.length < STANDARD_TEAM_MEMBERS
    ).length;

    return {
      total: teams.length,
      standard: standardTeams,
      exception: exceptionTeams,
      incomplete: incompleteTeams,
      availableStudents: availableStudents.length,
    };
  }, [availableStudents.length, teams]);

  const handleLogout = async () => {
    await signOutUser();
    toast.info('Sesión cerrada', 'Tu sesión fue cerrada correctamente.');
    navigate('/login', { replace: true });
  };

  const handleOpenProfile = () => {
    navigate('/profile');
  };

  const loadTeams = async () => {
    try {
      setIsLoadingTeams(true);

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
          createdAt: data.createdAt,
        };
      });

      setTeams(nextTeams);
    } catch (error) {
      console.error('Error cargando equipos:', error);
      toast.error(
        'No se pudieron cargar los equipos',
        'Revisa las reglas de Firestore y la colección teams.'
      );
    } finally {
      setIsLoadingTeams(false);
    }
  };

  const loadStudents = async () => {
    try {
      const usersRef = collection(db, 'users');
      const studentsQuery = query(usersRef, where('role', '==', 'student'));
      const snapshot = await getDocs(studentsQuery);

      const nextStudents: UserProfile[] = snapshot.docs.map((document) => {
        const data = document.data();

        return {
          uid: document.id,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          role: 'student',
          teamId: data.teamId ?? null,
          status:
            data.status === 'inactive' || data.status === 'invited'
              ? data.status
              : 'active',
        };
      });

      setStudents(nextStudents);
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
      toast.error(
        'No se pudieron cargar los estudiantes',
        'Revisa las reglas de Firestore y la colección users.'
      );
    }
  };

  useEffect(() => {
    void Promise.all([loadTeams(), loadStudents()]);
  }, []);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((currentIds) => {
      if (currentIds.includes(studentId)) {
        return currentIds.filter((id) => id !== studentId);
      }

      if (currentIds.length >= EXCEPTION_TEAM_MEMBERS) {
        toast.warning(
          'Límite alcanzado',
          'Un equipo puede tener un máximo excepcional de 4 estudiantes.'
        );
        return currentIds;
      }

      return [...currentIds, studentId];
    });
  };

  const handleToggleEditStudent = (studentId: string) => {
    setEditSelectedStudentIds((currentIds) => {
      if (currentIds.includes(studentId)) {
        return currentIds.filter((id) => id !== studentId);
      }

      if (currentIds.length >= EXCEPTION_TEAM_MEMBERS) {
        toast.warning(
          'Límite alcanzado',
          'Un equipo puede tener un máximo excepcional de 4 estudiantes.'
        );
        return currentIds;
      }

      return [...currentIds, studentId];
    });
  };

  const resetCreateForm = () => {
    setTeamName('');
    setSelectedStudentIds([]);
  };

  const handleCloseCreateModal = () => {
    if (isSaving) {
      return;
    }

    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  const resetEditForm = () => {
    setSelectedTeam(null);
    setEditTeamName('');
    setEditSelectedStudentIds([]);
  };

  const handleOpenEditModal = (team: TeamRecord) => {
    const validMemberIds = team.memberIds.filter((memberId) =>
      existingStudentIds.has(memberId)
    );

    setSelectedTeam(team);
    setEditTeamName(team.name);
    setEditSelectedStudentIds(validMemberIds);
  };

  const handleCloseEditModal = () => {
    if (isUpdatingTeam) {
      return;
    }

    resetEditForm();
  };

  const handleOpenDeleteModal = (team: TeamRecord) => {
    setTeamToDelete(team);
  };

  const handleCloseDeleteModal = () => {
    if (isDeletingTeam) {
      return;
    }

    setTeamToDelete(null);
  };

  const handleCreateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!teamName.trim()) {
      toast.warning(
        'Nombre requerido',
        'Debes ingresar un nombre para el equipo.'
      );
      return;
    }

    if (selectedStudentIds.length < 1) {
      toast.warning(
        'Integrantes requeridos',
        'Debes seleccionar al menos un estudiante.'
      );
      return;
    }

    if (selectedStudentIds.length > STANDARD_TEAM_MEMBERS) {
      toast.warning(
        'Límite excedido',
        'Un equipo nuevo solo puede iniciar con entre 1 y 3 integrantes.'
      );
      return;
    }

    try {
      setIsSaving(true);

      const normalizedTeamName = teamName.trim();
      const validSelectedStudentIds = selectedStudentIds.filter((studentId) =>
        existingStudentIds.has(studentId)
      );

      if (validSelectedStudentIds.length < 1) {
        toast.warning(
          'Integrantes inválidos',
          'Los estudiantes seleccionados ya no están disponibles. Vuelve a intentarlo.'
        );
        return;
      }

      const validSelectedStudents = selectedStudents.filter((student) =>
        validSelectedStudentIds.includes(student.uid)
      );

      const teamRef = doc(collection(db, 'teams'));
      const internalChatRef = doc(
        db,
        'chats',
        getTeamInternalChatId(teamRef.id)
      );
      const professorChatRef = doc(
        db,
        'chats',
        getTeamProfessorChatId(teamRef.id)
      );

      const batch = writeBatch(db);

      batch.set(teamRef, {
        name: normalizedTeamName,
        memberIds: validSelectedStudentIds,
        memberNames: validSelectedStudents.map(buildMemberLabel),
        createdBy: profile?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      validSelectedStudentIds.forEach((studentId) => {
        const studentRef = doc(db, 'users', studentId);

        batch.update(studentRef, {
          teamId: teamRef.id,
          updatedAt: serverTimestamp(),
        });
      });

      batch.set(internalChatRef, {
        type: 'team_internal',
        title: buildInternalChatTitle(normalizedTeamName),
        subtitle: 'En línea · Equipo',
        teamId: teamRef.id,
        participantIds: validSelectedStudentIds,
        createdBy: profile?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageText: '',
        lastMessageAt: null,
        lastMessageSenderId: null,
        isDeleted: false,
      });

      batch.set(professorChatRef, {
        type: 'team_professor',
        title: buildProfessorChatTitle(normalizedTeamName),
        subtitle: 'En línea · Profesor',
        teamId: teamRef.id,
        participantIds: validSelectedStudentIds,
        createdBy: profile?.uid ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageText: '',
        lastMessageAt: null,
        lastMessageSenderId: null,
        isDeleted: false,
      });

      await batch.commit();

      toast.success(
        'Equipo creado',
        'El equipo, sus integrantes y sus chats se guardaron correctamente.'
      );

      setIsCreateModalOpen(false);
      resetCreateForm();

      await Promise.all([loadTeams(), loadStudents()]);
    } catch (error) {
      console.error('Error creando equipo:', error);
      toast.error(
        'No se pudo crear el equipo',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedTeam) {
      return;
    }

    if (!editTeamName.trim()) {
      toast.warning(
        'Nombre requerido',
        'Debes ingresar un nombre para el equipo.'
      );
      return;
    }

    const validNextMemberIds = editSelectedStudentIds.filter((studentId) =>
      existingStudentIds.has(studentId)
    );

    if (validNextMemberIds.length < 1) {
      toast.warning(
        'Integrantes requeridos',
        'Debes seleccionar al menos un estudiante válido.'
      );
      return;
    }

    if (validNextMemberIds.length > EXCEPTION_TEAM_MEMBERS) {
      toast.warning(
        'Límite excedido',
        'Un equipo solo puede llegar a 4 integrantes como excepción.'
      );
      return;
    }

    try {
      setIsUpdatingTeam(true);

      const normalizedTeamName = editTeamName.trim();
      const validEditSelectedStudents = editSelectedStudents.filter((student) =>
        validNextMemberIds.includes(student.uid)
      );

      const batch = writeBatch(db);
      const teamRef = doc(db, 'teams', selectedTeam.id);
      const internalChatRef = doc(
        db,
        'chats',
        getTeamInternalChatId(selectedTeam.id)
      );
      const professorChatRef = doc(
        db,
        'chats',
        getTeamProfessorChatId(selectedTeam.id)
      );

      const previousExistingMemberIds = selectedTeam.memberIds.filter((memberId) =>
        existingStudentIds.has(memberId)
      );

      const previousMemberIdsSet = new Set(previousExistingMemberIds);
      const nextMemberIdsSet = new Set(validNextMemberIds);

      const removedMemberIds = previousExistingMemberIds.filter(
        (memberId) => !nextMemberIdsSet.has(memberId)
      );

      const addedMemberIds = validNextMemberIds.filter(
        (memberId) => !previousMemberIdsSet.has(memberId)
      );

      batch.update(teamRef, {
        name: normalizedTeamName,
        memberIds: validNextMemberIds,
        memberNames: validEditSelectedStudents.map(buildMemberLabel),
        updatedAt: serverTimestamp(),
      });

      removedMemberIds.forEach((studentId) => {
        const studentRef = doc(db, 'users', studentId);

        batch.update(studentRef, {
          teamId: null,
          updatedAt: serverTimestamp(),
        });
      });

      addedMemberIds.forEach((studentId) => {
        const studentRef = doc(db, 'users', studentId);

        batch.update(studentRef, {
          teamId: selectedTeam.id,
          updatedAt: serverTimestamp(),
        });
      });

      batch.set(
        internalChatRef,
        {
          type: 'team_internal',
          title: buildInternalChatTitle(normalizedTeamName),
          subtitle: 'En línea · Equipo',
          teamId: selectedTeam.id,
          participantIds: validNextMemberIds,
          createdBy: profile?.uid ?? null,
          updatedAt: serverTimestamp(),
          isDeleted: false,
        },
        { merge: true }
      );

      batch.set(
        professorChatRef,
        {
          type: 'team_professor',
          title: buildProfessorChatTitle(normalizedTeamName),
          subtitle: 'En línea · Profesor',
          teamId: selectedTeam.id,
          participantIds: validNextMemberIds,
          createdBy: profile?.uid ?? null,
          updatedAt: serverTimestamp(),
          isDeleted: false,
        },
        { merge: true }
      );

      await batch.commit();

      toast.success(
        'Equipo actualizado',
        'Los cambios del equipo y sus chats se guardaron correctamente.'
      );

      resetEditForm();
      await Promise.all([loadTeams(), loadStudents()]);
    } catch (error) {
      console.error('Error actualizando equipo:', error);
      toast.error(
        'No se pudo actualizar el equipo',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) {
      return;
    }

    try {
      setIsDeletingTeam(true);

      const batch = writeBatch(db);
      const teamRef = doc(db, 'teams', teamToDelete.id);
      const internalChatRef = doc(
        db,
        'chats',
        getTeamInternalChatId(teamToDelete.id)
      );
      const professorChatRef = doc(
        db,
        'chats',
        getTeamProfessorChatId(teamToDelete.id)
      );

      const validMemberIdsToClear = teamToDelete.memberIds.filter((studentId) =>
        existingStudentIds.has(studentId)
      );

      validMemberIdsToClear.forEach((studentId) => {
        const studentRef = doc(db, 'users', studentId);

        batch.update(studentRef, {
          teamId: null,
          updatedAt: serverTimestamp(),
        });
      });

      batch.set(
        internalChatRef,
        {
          type: 'team_internal',
          title: `Archivado · ${teamToDelete.name}`,
          subtitle: 'Chat archivado',
          teamId: teamToDelete.id,
          participantIds: [],
          createdBy: profile?.uid ?? null,
          updatedAt: serverTimestamp(),
          isDeleted: true,
        },
        { merge: true }
      );

      batch.set(
        professorChatRef,
        {
          type: 'team_professor',
          title: `Archivado · Profesor / ${teamToDelete.name}`,
          subtitle: 'Chat archivado',
          teamId: teamToDelete.id,
          participantIds: [],
          createdBy: profile?.uid ?? null,
          updatedAt: serverTimestamp(),
          isDeleted: true,
        },
        { merge: true }
      );

      batch.delete(teamRef);

      await batch.commit();

      toast.success(
        'Equipo disuelto',
        'El equipo fue eliminado, sus integrantes quedaron disponibles y los chats quedaron archivados.'
      );

      setTeamToDelete(null);
      await Promise.all([loadTeams(), loadStudents()]);
    } catch (error) {
      console.error('Error disolviendo equipo:', error);
      toast.error(
        'No se pudo disolver el equipo',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsDeletingTeam(false);
    }
  };


  const handleCloseExtendModal = () => {
    if (isExtendingTeam) {
      return;
    }

    setTeamToExtend(null);
    setExtensionStudentId('');
  };

  const handleExtendTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!teamToExtend || !extensionStudentId) {
      toast.warning(
        'Integrante requerido',
        'Debes seleccionar el estudiante que se agregará al equipo.'
      );
      return;
    }

    if (teamToExtend.memberIds.length >= EXCEPTION_TEAM_MEMBERS) {
      toast.warning(
        'Límite alcanzado',
        'Este equipo ya alcanzó el máximo excepcional de 4 integrantes.'
      );
      return;
    }

    const studentToAdd = students.find((student) => student.uid === extensionStudentId);

    if (!studentToAdd || studentToAdd.teamId != null) {
      toast.warning(
        'Integrante inválido',
        'El estudiante seleccionado ya no está disponible.'
      );
      return;
    }

    try {
      setIsExtendingTeam(true);

      const nextMemberIds = [...teamToExtend.memberIds, studentToAdd.uid];
      const nextMemberNames = [...teamToExtend.memberNames, buildMemberLabel(studentToAdd)];
      const batch = writeBatch(db);
      const teamRef = doc(db, 'teams', teamToExtend.id);
      const internalChatRef = doc(db, 'chats', getTeamInternalChatId(teamToExtend.id));
      const professorChatRef = doc(db, 'chats', getTeamProfessorChatId(teamToExtend.id));
      const studentRef = doc(db, 'users', studentToAdd.uid);

      batch.update(teamRef, {
        memberIds: nextMemberIds,
        memberNames: nextMemberNames,
        updatedAt: serverTimestamp(),
      });

      batch.update(studentRef, {
        teamId: teamToExtend.id,
        updatedAt: serverTimestamp(),
      });

      batch.set(
        internalChatRef,
        {
          participantIds: nextMemberIds,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      batch.set(
        professorChatRef,
        {
          participantIds: nextMemberIds,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      toast.success(
        'Integrante agregado',
        'Se aplicó la excepción y el equipo ahora tiene un integrante adicional.'
      );

      setTeamToExtend(null);
      setExtensionStudentId('');
      await Promise.all([loadTeams(), loadStudents()]);
    } catch (error) {
      console.error('Error agregando integrante excepcional:', error);
      toast.error(
        'No se pudo ampliar el equipo',
        'Verifica las reglas y vuelve a intentarlo.'
      );
    } finally {
      setIsExtendingTeam(false);
    }
  };

  return (
    <>
      <AppShell
        title="Equipos"
        subtitle="Crea, filtra y administra equipos de trabajo, con control visual de integrantes y disponibilidad."
        isDarkMode={isDarkMode}
        onToggleTheme={onToggleTheme}
        onLogout={handleLogout}
        onOpenProfile={handleOpenProfile}
      >
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Equipos totales</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{teamsSummary.total}</p>
            </article>
            <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Equipos estándar</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{teamsSummary.standard}</p>
            </article>
            <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Equipos con excepción</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">{teamsSummary.exception}</p>
            </article>
            <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Equipos incompletos</p>
              <p className="mt-2 text-2xl font-semibold text-sky-700 dark:text-sky-300">{teamsSummary.incomplete}</p>
            </article>
            <article className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400">Estudiantes disponibles</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--app-fg)]">{teamsSummary.availableStudents}</p>
            </article>
          </section>

          <section className="rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
            <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Listado de equipos</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Gestiona grupos de trabajo, encuentra integrantes rápido y detecta equipos incompletos.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por equipo o integrante"
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                />
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value as 'all' | 'standard' | 'exception' | 'incomplete')}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="all">Todos los equipos</option>
                  <option value="standard">Equipos estándar</option>
                  <option value="exception">Con excepción de 4</option>
                  <option value="incomplete">Equipos incompletos</option>
                </select>
              </div>
            </header>

          {isLoadingTeams ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-sm text-slate-600 dark:text-slate-400">
              Cargando equipos...
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="group flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-center transition hover:bg-[var(--app-surface)]"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-400 text-slate-500 transition group-hover:border-[color:var(--action-positive-border)] group-hover:text-[var(--action-positive-border)] dark:border-slate-500 dark:text-slate-400">
                  <span className="text-4xl font-semibold leading-none">+</span>
                </div>

                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  Crear equipo
                </h3>

                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Agrega un nuevo equipo y asigna de 1 a 3 estudiantes disponibles.
                </p>

                <span className="mt-4 text-sm font-medium text-[var(--action-positive-border)]">
                  Nueva acción
                </span>
              </button>

              {filteredTeams.length === 0 ? (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  No hay equipos que coincidan con la búsqueda o el filtro actual. Ajusta los criterios o crea uno nuevo.
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <article
                    key={team.id}
                    className="h-full overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)]"
                  >
                    <div className="flex h-full flex-col px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-xl font-semibold tracking-tight text-[var(--app-fg)]">
                              {team.name}
                            </h3>

                            <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {team.memberIds.length} integrante(s)
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Equipo activo dentro del simulador empresarial.
                          </p>
                        </div>

                        <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Activo
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            Integrantes
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[var(--app-fg)]">
                            {team.memberIds.length}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            Capacidad
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-lg font-semibold text-[var(--app-fg)]">
                              {team.memberIds.length}/{EXCEPTION_TEAM_MEMBERS}
                            </p>
                            {team.memberIds.length < EXCEPTION_TEAM_MEMBERS ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTeamToExtend(team);
                                  setExtensionStudentId('');
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] text-sm font-semibold text-[var(--app-fg)] transition hover:bg-[var(--app-bg)]"
                                title="Agregar integrante excepcional"
                                aria-label="Agregar integrante excepcional"
                              >
                                +
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex-1 border-t border-[color:var(--app-border)] pt-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--app-fg)]">
                            Integrantes del equipo
                          </p>

                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Base 3 · excepción 4
                          </span>
                        </div>

                        <div className="grid gap-2">
                          {team.memberNames.length > 0 ? (
                            team.memberNames.map((memberName) => (
                              <div
                                key={`${team.id}-${memberName}`}
                                className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3"
                              >
                                <p className="text-sm font-medium text-[var(--app-fg)]">
                                  {memberName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  Miembro asignado al equipo
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                              Este equipo todavía no tiene integrantes registrados.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(team)}
                          className={`${neutralActionButtonClass} flex-1`}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(team)}
                          className={`${negativeActionButtonClass} flex-1`}
                        >
                          Disolver
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
          </section>
        </div>
      </AppShell>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-3xl">
            <div className="max-h-[88vh] overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
              <div className="border-b border-[color:var(--app-border)] px-6 py-5 sm:px-8">
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  Crear equipo
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Asigna de 1 a 3 estudiantes activos que todavía no pertenezcan a
                  otro equipo.
                </p>
              </div>

              <form
                className="grid max-h-[calc(88vh-88px)] grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.35fr)_340px]"
                onSubmit={handleCreateTeam}
              >
                <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">
                  <div>
                    <label
                      htmlFor="teamName"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Nombre del equipo
                    </label>
                    <input
                      id="teamName"
                      type="text"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                    />
                  </div>

                  <section className="mt-6 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Estudiantes disponibles
                      </label>
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {selectedStudentIds.length}/3 seleccionados
                      </span>
                    </div>

                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {availableStudents.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No hay estudiantes disponibles en este momento.
                        </p>
                      ) : (
                        availableStudents.map((student) => {
                          const isSelected = selectedStudentIds.includes(student.uid);

                          return (
                            <button
                              key={student.uid}
                              type="button"
                              onClick={() => handleToggleStudent(student.uid)}
                              className={[
                                'flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition',
                                isSelected
                                  ? 'border-[color:var(--action-positive-border)] bg-[var(--action-positive-bg)]/20'
                                  : 'border-[color:var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-bg)]',
                              ].join(' ')}
                            >
                              <div className="min-w-0 pr-4">
                                <p className="truncate text-sm font-medium text-[var(--app-fg)]">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {student.email}
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {isSelected ? 'Seleccionado' : 'Disponible'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>

                <aside className="flex min-h-0 flex-col border-t border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-6 py-6 lg:border-l lg:border-t-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--app-fg)]">
                      Integrantes seleccionados
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Resumen actual del equipo.
                    </p>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                    {selectedStudents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-slate-500 dark:text-slate-400">
                        Todavía no has seleccionado estudiantes.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedStudents.map((student) => (
                          <div
                            key={student.uid}
                            className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3"
                          >
                            <p className="text-sm font-medium text-[var(--app-fg)]">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {student.email}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end lg:flex-col">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={positiveActionButtonClass}
                    >
                      {isSaving ? 'Guardando...' : 'Crear equipo'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseCreateModal}
                      disabled={isSaving}
                      className={neutralActionButtonClass}
                    >
                      Cancelar
                    </button>
                  </div>
                </aside>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTeam ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-3xl">
            <div className="max-h-[88vh] overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
              <div className="border-b border-[color:var(--app-border)] px-6 py-5 sm:px-8">
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                  Editar equipo
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Ajusta el nombre del equipo y administra sus integrantes.
                </p>
              </div>

              <form
                className="grid max-h-[calc(88vh-88px)] grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.35fr)_340px]"
                onSubmit={handleUpdateTeam}
              >
                <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-8">
                  <div>
                    <label
                      htmlFor="editTeamName"
                      className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Nombre del equipo
                    </label>
                    <input
                      id="editTeamName"
                      type="text"
                      value={editTeamName}
                      onChange={(event) => setEditTeamName(event.target.value)}
                      className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                    />
                  </div>

                  <section className="mt-6 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Estudiantes disponibles
                      </label>
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {editSelectedStudentIds.length}/3 seleccionados
                      </span>
                    </div>

                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {editableStudents.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No hay estudiantes disponibles en este momento.
                        </p>
                      ) : (
                        editableStudents.map((student) => {
                          const isSelected = editSelectedStudentIds.includes(
                            student.uid
                          );

                          return (
                            <button
                              key={student.uid}
                              type="button"
                              onClick={() => handleToggleEditStudent(student.uid)}
                              className={[
                                'flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition',
                                isSelected
                                  ? 'border-[color:var(--action-positive-border)] bg-[var(--action-positive-bg)]/20'
                                  : 'border-[color:var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-bg)]',
                              ].join(' ')}
                            >
                              <div className="min-w-0 pr-4">
                                <p className="truncate text-sm font-medium text-[var(--app-fg)]">
                                  {student.firstName} {student.lastName}
                                </p>
                                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {student.email}
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {isSelected ? 'Seleccionado' : 'Disponible'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>

                <aside className="flex min-h-0 flex-col border-t border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-6 py-6 lg:border-l lg:border-t-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--app-fg)]">
                      Integrantes seleccionados
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Resumen actualizado del equipo.
                    </p>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                    {editSelectedStudents.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[var(--app-surface)] p-4 text-sm text-slate-500 dark:text-slate-400">
                        Todavía no has seleccionado estudiantes.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editSelectedStudents.map((student) => (
                          <div
                            key={student.uid}
                            className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3"
                          >
                            <p className="text-sm font-medium text-[var(--app-fg)]">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {student.email}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end lg:flex-col">
                    <button
                      type="submit"
                      disabled={isUpdatingTeam}
                      className={positiveActionButtonClass}
                    >
                      {isUpdatingTeam ? 'Guardando...' : 'Guardar cambios'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseEditModal}
                      disabled={isUpdatingTeam}
                      className={neutralActionButtonClass}
                    >
                      Cancelar
                    </button>
                  </div>
                </aside>
              </form>
            </div>
          </div>
        </div>
      ) : null}


      {teamToExtend ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <header>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                Agregar integrante excepcional
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Esta opción permite llevar temporalmente el equipo a un máximo de 4 integrantes.
              </p>
            </header>

            <form className="mt-6 grid gap-4" onSubmit={handleExtendTeam}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Estudiante disponible
                </label>
                <select
                  value={extensionStudentId}
                  onChange={(event) => setExtensionStudentId(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-fg)] outline-none transition"
                >
                  <option value="">Selecciona un estudiante</option>
                  {extensionCandidates.map((student) => (
                    <option key={student.uid} value={student.uid}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4 text-sm text-slate-600 dark:text-slate-400">
                Equipo actual: <span className="font-medium text-[var(--app-fg)]">{teamToExtend.name}</span> · Capacidad resultante: {teamToExtend.memberIds.length + 1}/{EXCEPTION_TEAM_MEMBERS}
              </div>

              <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={handleCloseExtendModal} disabled={isExtendingTeam} className={neutralActionButtonClass}>
                  Cancelar
                </button>
                <button type="submit" disabled={isExtendingTeam} className={positiveActionButtonClass}>
                  {isExtendingTeam ? 'Guardando...' : 'Agregar integrante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {teamToDelete ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <header>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--app-fg)]">
                Disolver equipo
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Esta acción eliminará el equipo{' '}
                <span className="font-medium text-[var(--app-fg)]">
                  {teamToDelete.name}
                </span>{' '}
                y dejará a sus integrantes disponibles nuevamente.
              </p>
            </header>

            <div className="mt-5 rounded-2xl border border-[color:var(--app-border)] bg-[var(--app-surface-muted)] p-4">
              <p className="text-sm font-medium text-[var(--app-fg)]">
                Integrantes afectados
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {teamToDelete.memberNames.length > 0 ? (
                  teamToDelete.memberNames.map((memberName) => (
                    <span
                      key={`${teamToDelete.id}-${memberName}`}
                      className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-fg)]"
                    >
                      {memberName}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Este equipo no tiene integrantes registrados.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={isDeletingTeam}
                className={neutralActionButtonClass}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteTeam}
                disabled={isDeletingTeam}
                className={negativeActionButtonClass}
              >
                {isDeletingTeam ? 'Disolviendo...' : 'Disolver equipo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}