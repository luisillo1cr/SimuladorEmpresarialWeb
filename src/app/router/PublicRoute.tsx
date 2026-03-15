import { Navigate, Outlet } from 'react-router-dom';
import { FullScreenLoader } from '../../components/ui/FullScreenLoader';
import { useAuth } from '../../hooks/useAuth';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}