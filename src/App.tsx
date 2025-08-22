import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TournamentList from "./pages/TournamentList";
import RefereeDesk from "./pages/RefereeDesk";
import PublicScoreboard from "./pages/PublicScoreboard";
import SpectatorView from "./pages/SpectatorView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tournaments" element={<TournamentList />} />
          <Route path="/referee/:gameId" element={<RefereeDesk />} />
          <Route path="/scoreboard/:gameId" element={<PublicScoreboard />} />
          <Route path="/spectator/:gameId" element={<SpectatorView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
