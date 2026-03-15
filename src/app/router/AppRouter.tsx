import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { ProfilePage } from '../../pages/ProfilePage';
import { UsersPage } from '../../pages/UsersPage';
import { TeamsPage } from '../../pages/TeamsPage';
import { CompaniesPage } from '../../pages/CompaniesPage';
import { CompanyDetailPage } from '../../pages/CompanyDetailPage';
import { MyCompanyPage } from '../../pages/MyCompanyPage';
import { CompanyOperationsPage } from '../../pages/CompanyOperationsPage';
import { CompleteSigninPage } from '../../pages/CompleteSigninPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { RoleRoute } from './RoleRoute';

type AppRouterProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

export function AppRouter({
  isDarkMode,
  onToggleTheme,
}: AppRouterProps) {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route
          path="/login"
          element={
            <LoginPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/complete-signin"
          element={
            <CompleteSigninPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <DashboardPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/profile"
          element={
            <ProfilePage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/my-company"
          element={
            <MyCompanyPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/company-operations/:companyId"
          element={
            <CompanyOperationsPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />
      </Route>

      <Route element={<RoleRoute allowedRoles={['admin', 'professor']} />}>
        <Route
          path="/admin/users"
          element={
            <UsersPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/admin/teams"
          element={
            <TeamsPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/admin/companies"
          element={
            <CompaniesPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />

        <Route
          path="/admin/companies/:companyId"
          element={
            <CompanyDetailPage
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}