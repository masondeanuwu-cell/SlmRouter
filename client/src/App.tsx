import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import LogViewer from "@/components/log-viewer";
import Browser from "./pages/Browser";
import { ThemeProvider } from "@/components/theme-provider";
import UserLogin from "./pages/slm-login";
import LandingPage from "@/pages/Landing-page";

function Router() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [location] = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600 mb-4"></i>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && location === "/dashboard") {
    return <Login onLogin={login} />;
  }else if (!isAuthenticated && location === "/slmbrowser") {
    return <UserLogin onLogin={login} />;
  }

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/logs" component={LogViewer} /> {/* NEW */}
      <Route path="/slmbrowser" component={Browser} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
