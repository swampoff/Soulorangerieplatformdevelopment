import { useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './components/AuthContext';
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

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const { isAuthenticated, canAccess, user } = useAuth();

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const renderPage = () => {
    // Handle practice detail pages: "practice:ID"
    if (currentPage.startsWith('practice:')) {
      const practiceId = currentPage.split(':')[1];
      return <PracticeDetailPage practiceId={practiceId} onNavigate={handleNavigate} />;
    }

    switch (currentPage) {
      case 'home':
        return <LandingPage onNavigate={handleNavigate} />;
      case 'practices':
        return <PracticesPage onNavigate={handleNavigate} />;
      case 'diagnostic':
        return <DiagnosticPage onNavigate={handleNavigate} />;
      case 'schedule':
        return <SchedulePage onNavigate={handleNavigate} />;
      case 'instructors':
        return <InstructorsPage onNavigate={handleNavigate} />;
      case 'pricing':
        return <PricingPage onNavigate={handleNavigate} />;

      // Auth page: redirect to dashboard if already logged in
      case 'auth':
        if (isAuthenticated) {
          // Redirect based on role
          if (user?.role === 'admin') {
            return <AdminPanelPage onNavigate={handleNavigate} />;
          }
          if (user?.role === 'instructor') {
            return <InstructorPanelPage onNavigate={handleNavigate} />;
          }
          return <DashboardPage onNavigate={handleNavigate} />;
        }
        return <AuthPage onNavigate={handleNavigate} />;

      // Protected: any authenticated user
      case 'dashboard':
        if (!isAuthenticated) {
          return <AuthPage onNavigate={handleNavigate} />;
        }
        return <DashboardPage onNavigate={handleNavigate} />;

      // Protected: instructor or admin only
      case 'instructor-panel':
        if (!isAuthenticated) {
          return <AuthPage onNavigate={handleNavigate} />;
        }
        if (!canAccess('instructor-panel')) {
          return <AccessDeniedPage onNavigate={handleNavigate} requiredRole="instructor" />;
        }
        return <InstructorPanelPage onNavigate={handleNavigate} />;

      // Protected: admin only
      case 'admin-panel':
        if (!isAuthenticated) {
          return <AuthPage onNavigate={handleNavigate} />;
        }
        if (!canAccess('admin-panel')) {
          return <AccessDeniedPage onNavigate={handleNavigate} requiredRole="admin" />;
        }
        return <AdminPanelPage onNavigate={handleNavigate} />;

      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <Header currentPage={currentPage} onNavigate={handleNavigate} />
      <main>{renderPage()}</main>
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}