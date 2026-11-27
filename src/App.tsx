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
import pagePal from "@/assets/avatars/page-pal.webp";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="bookser-loading" role="status">
        <img src={pagePal} width={68} height={68} alt="" />
        <span>Открываем Bookser…</span>
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
