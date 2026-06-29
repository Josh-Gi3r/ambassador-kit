import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Ambassador from "./pages/Ambassador";
import Apply from "./pages/Apply";
import Roles from "./pages/Roles";
import Leaderboard from "./pages/Leaderboard";
import AmbassadorDashboard from "./pages/AmbassadorDashboard";
import AdminDashboardView from "./pages/AdminDashboardView";
import XPSystem from "./pages/XPSystem";
import Badges from "./pages/Badges";
import ApplySuccess from "./pages/ApplySuccess";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/ambassador"} component={Ambassador} />
      <Route path={"/apply"} component={Apply} />
      <Route path={"/apply/success"} component={ApplySuccess} />
      <Route path={"/roles"} component={Roles} />
      <Route path={"/leaderboard"} component={Leaderboard} />
      <Route path={"/dashboard"} component={AmbassadorDashboard} />
      <Route path={"/dashboard/:handle"} component={AmbassadorDashboard} />
      <Route path={"/xp"} component={XPSystem} />
      <Route path={"/xp-system"} component={XPSystem} />
      <Route path={"/badges"} component={Badges} />
      <Route path={"/ambassador/:id"} component={() => { window.location.replace("/leaderboard"); return null; }} />
      <Route path={"/admin/dashboard/:id"} component={AdminDashboardView} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ScrollToTop />
          <Router />
          <MobileBottomNav />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
