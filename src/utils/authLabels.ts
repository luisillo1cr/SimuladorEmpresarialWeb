import type { UserRole } from '../types/auth';

export function getRoleLabel(role?: UserRole | string | null) {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'professor':
      return 'Profesor';
    case 'student':
      return 'Estudiante';
    default:
      return 'Sin definir';
  }
}

export function getStatusLabel(status?: string | null) {
  switch (status) {
    case 'active':
      return 'Activo';
    case 'inactive':
      return 'Inactivo';
    case 'invited':
      return 'Invitado';
    default:
      return 'Sin definir';
  }
}