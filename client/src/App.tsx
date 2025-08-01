import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ETFProvider } from "@/context/etf-context";
import Dashboard from "@/pages/dashboard";
import DataQualityDashboard from "@/pages/DataQualityDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/data-quality" component={DataQualityDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ETFProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ETFProvider>
    </QueryClientProvider>
  );
}

export default App;
