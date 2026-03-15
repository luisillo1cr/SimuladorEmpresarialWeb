import { Navigate, Outlet } from 'react-router-dom';
import { FullScreenLoader } from '../../components/ui/FullScreenLoader';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/auth';

type RoleRouteProps = {
  allowedRoles: UserRole[];
};

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { profile, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}