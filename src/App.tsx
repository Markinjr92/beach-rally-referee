import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import TournamentInfo from "./pages/TournamentInfo";
import TournamentInfoDetail from "./pages/TournamentInfoDetail";
import TournamentsDB from "./pages/TournamentsDB";
import TournamentDetailDB from "./pages/TournamentDetailDB";
import RefereeDesk from "./pages/RefereeDesk";
import PublicScoreboard from "./pages/PublicScoreboard";
import SpectatorView from "./pages/SpectatorView";
import NotFound from "./pages/NotFound";
import LiveMatches from "./pages/LiveMatches";
import AdminUserManagementPage from "./pages/AdminUserManagementPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tournament-info" element={<TournamentInfo />} />
            <Route path="/tournament-info/:tournamentId" element={<TournamentInfoDetail />} />
            <Route path="/tournaments" element={<TournamentsDB />} />
            <Route path="/tournament/:tournamentId" element={<TournamentDetailDB />} />
            <Route path="/referee/:gameId" element={<RefereeDesk />} />
            <Route path="/scoreboard/:gameId" element={<PublicScoreboard />} />
            <Route path="/spectator/:gameId" element={<SpectatorView />} />
            <Route path="/live" element={<LiveMatches />} />
            <Route path="/admin/users" element={<AdminUserManagementPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
