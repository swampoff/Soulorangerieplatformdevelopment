import { createBrowserRouter, Outlet, useNavigate, useOutletContext, useLocation, useParams, Navigate } from 'react-router';
import { useCallback, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuth } from './components/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { PracticesPage } from './components/PracticesPage';
import { PracticeDetailPage } from './components/PracticeDetailPage';
import { DiagnosticPage } from './components/DiagnosticPage';
import { SchedulePage } from './components/SchedulePage';
import { InstructorsPage } from './components/InstructorsPage';
import { PricingPage } from './components/PricingPage';
import { DashboardPage } from './components/DashboardPage';
import { InstructorPanelPage } from './components/InstructorPanelPage';
import { AdminPanelPage } from './components/AdminPanelPage';
import { AuthPage } from './components/AuthPage';
import { AccessDeniedPage } from './components/AccessDeniedPage';
import { ProfileSettingsPage } from './components/ProfileSettingsPage';

// ============================================================
// Mapping between legacy page IDs and URL paths
// ============================================================
const PAGE_TO_PATH: Record<string, string> = {
  home: '/',
  practices: '/practices',
  diagnostic: '/diagnostic',
  schedule: '/schedule',
  instructors: '/instructors',
  pricing: '/pricing',
  auth: '/auth',
  dashboard: '/dashboard',
  'instructor-panel': '/instructor-panel',
  'admin-panel': '/manage-s0ul',
  'profile-settings': '/settings',
};

const PATH_TO_PAGE: Record<string, string> = {};
for (const [page, path] of Object.entries(PAGE_TO_PATH)) {
  PATH_TO_PAGE[path] = page;
}

/** Convert a legacy page id (e.g. "practice:abc") to a URL path */
function pageToPath(page: string): string {
  if (page.startsWith('practice:')) {
    const id = page.split(':')[1];
    return `/practices/${id}`;
  }
  return PAGE_TO_PATH[page] || '/';
}

/** Convert current pathname to a legacy page id for Header highlight */
function pathToPage(pathname: string): string {
  if (pathname.startsWith('/practices/')) return `practice:${pathname.split('/')[2]}`;
  return PATH_TO_PAGE[pathname] || 'home';
}

// ============================================================
// Outlet context type
// ============================================================
interface OutletCtx {
  onNavigate: (page: string) => void;
}

export function useAppNavigate() {
  return useOutletContext<OutletCtx>();
}

// ============================================================
// Root Layout
// ============================================================
function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = pathToPage(location.pathname);

  const onNavigate = useCallback(
    (page: string) => {
      const path = pageToPath(page);
      navigate(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate],
  );

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <Header currentPage={currentPage} onNavigate={onNavigate} />
      <main>
        <Outlet context={{ onNavigate } satisfies OutletCtx} />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}

// ============================================================
// Auth guard wrapper
// ============================================================
function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuth();
  const { onNavigate } = useAppNavigate();

  if (!isAuthenticated) {
    return <AuthPage onNavigate={onNavigate} />;
  }

  if (roles && roles.length > 0) {
    const hasAccess = roles.includes(user?.role || '');
    if (!hasAccess) {
      return <AccessDeniedPage onNavigate={onNavigate} requiredRole={roles[0] as any} />;
    }
  }

  return <>{children}</>;
}

// ============================================================
// Page wrappers
// ============================================================
function HomePage() {
  const { onNavigate } = useAppNavigate();
  return <LandingPage onNavigate={onNavigate} />;
}

function PracticesRoute() {
  const { onNavigate } = useAppNavigate();
  return <PracticesPage onNavigate={onNavigate} />;
}

function PracticeDetailRoute() {
  const { id } = useParams();
  const { onNavigate } = useAppNavigate();
  return <PracticeDetailPage practiceId={id || ''} onNavigate={onNavigate} />;
}

function DiagnosticRoute() {
  const { onNavigate } = useAppNavigate();
  return <DiagnosticPage onNavigate={onNavigate} />;
}

function ScheduleRoute() {
  const { onNavigate } = useAppNavigate();
  return <SchedulePage onNavigate={onNavigate} />;
}

function InstructorsRoute() {
  const { onNavigate } = useAppNavigate();
  return <InstructorsPage onNavigate={onNavigate} />;
}

function PricingRoute() {
  const { onNavigate } = useAppNavigate();
  return <PricingPage onNavigate={onNavigate} />;
}

function AuthRoute() {
  const { isAuthenticated, user } = useAuth();
  const { onNavigate } = useAppNavigate();

  if (isAuthenticated) {
    // Redirect by role
    if (user?.role === 'admin') return <Navigate to="/manage-s0ul" replace />;
    if (user?.role === 'instructor') return <Navigate to="/instructor-panel" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <AuthPage onNavigate={onNavigate} />;
}

function DashboardRoute() {
  const { onNavigate } = useAppNavigate();
  return (
    <RequireAuth>
      <DashboardPage onNavigate={onNavigate} />
    </RequireAuth>
  );
}

function InstructorPanelRoute() {
  const { onNavigate } = useAppNavigate();
  return (
    <RequireAuth roles={['instructor', 'admin']}>
      <InstructorPanelPage onNavigate={onNavigate} />
    </RequireAuth>
  );
}

function AdminPanelRoute() {
  const { onNavigate } = useAppNavigate();
  return (
    <RequireAuth roles={['admin']}>
      <AdminPanelPage onNavigate={onNavigate} />
    </RequireAuth>
  );
}

function SettingsRoute() {
  const { onNavigate } = useAppNavigate();
  return (
    <RequireAuth>
      <ProfileSettingsPage onNavigate={onNavigate} />
    </RequireAuth>
  );
}

function NotFoundRoute() {
  return <Navigate to="/" replace />;
}

// ============================================================
// Router
// ============================================================
export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'practices', Component: PracticesRoute },
      { path: 'practices/:id', Component: PracticeDetailRoute },
      { path: 'diagnostic', Component: DiagnosticRoute },
      { path: 'schedule', Component: ScheduleRoute },
      { path: 'instructors', Component: InstructorsRoute },
      { path: 'pricing', Component: PricingRoute },
      { path: 'auth', Component: AuthRoute },
      { path: 'dashboard', Component: DashboardRoute },
      { path: 'instructor-panel', Component: InstructorPanelRoute },
      { path: 'manage-s0ul', Component: AdminPanelRoute },
      { path: 'settings', Component: SettingsRoute },
      // Legacy alias so old "profile-settings" links still work
      { path: 'profile-settings', element: <Navigate to="/settings" replace /> },
      { path: '*', Component: NotFoundRoute },
    ],
  },
]);