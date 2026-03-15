import { AuthProvider } from './app/providers/AuthProvider';
import { AppRouter } from './app/router/AppRouter';
import { AppToaster } from './components/ui/AppToaster';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <>
      <AppToaster />

      <AuthProvider>
        <AppRouter
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
        />
      </AuthProvider>
    </>
  );
}