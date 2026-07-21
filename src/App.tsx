import { Route, Switch, Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import LandingPage from "@/pages/LandingPage";
import ProfileSelectPage from "@/pages/ProfileSelectPage";
import LibraryPage from "@/pages/LibraryPage";
import ReadingPage from "@/pages/ReadingPage";
import DashboardPage from "@/pages/DashboardPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-5xl animate-bounce">📖</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      {user ? (
        <Switch>
          <Route path="/profiles" component={ProfileSelectPage} />
          <Route path="/library" component={LibraryPage} />
          <Route path="/read/:bookId" component={ReadingPage} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route><Redirect to="/profiles" /></Route>
        </Switch>
      ) : (
        <LandingPage />
      )}
    </ToastProvider>
  );
}
