import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import LandingPage from "@/pages/LandingPage";
import ProfileSelectPage from "@/pages/ProfileSelectPage";
import LibraryPage from "@/pages/LibraryPage";
import ReadingPage from "@/pages/ReadingPage";
import DashboardPage from "@/pages/DashboardPage";
import MathPage from "@/pages/MathPage";
import ArenaPage from "@/pages/ArenaPage";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="text-6xl animate-float">📖</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      {user ? (
        <>
          <Switch>
            <Route path="/profiles" component={ProfileSelectPage} />
            <Route path="/library" component={LibraryPage} />
            <Route path="/read/:bookId" component={ReadingPage} />
            <Route path="/math" component={MathPage} />
            <Route path="/arena" component={ArenaPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route><Redirect to="/profiles" /></Route>
          </Switch>
          <InstallPrompt />
        </>
      ) : (
        <LandingPage />
      )}
    </ToastProvider>
  );
}
