import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Parties from "./pages/Parties";
import PartyDetail from "./pages/PartyDetail";
import Coils from "./pages/Coils";
import CoilDetail from "./pages/CoilDetail";
import Packets from "./pages/Packets";
import Transfers from "./pages/Transfers";
import Transactions from "./pages/Transactions";
import Pricing from "./pages/Pricing";
import UsersPage from "./pages/Users";
import SettingsPage from "./pages/Settings";
import Billing from "./pages/Billing";
import InvoiceDetail from "./pages/InvoiceDetail";
import ClientLedger from "./pages/ClientLedger";
import AgingReport from "./pages/AgingReport";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/parties/:id" element={<PartyDetail />} />
            <Route path="/coils" element={<Coils />} />
            <Route path="/coils/:id" element={<CoilDetail />} />
            <Route path="/packets" element={<Packets />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Finance Module */}
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/:id" element={<InvoiceDetail />} />
            <Route path="/clients/:id/ledger" element={<ClientLedger />} />
            <Route path="/reports/aging" element={<AgingReport />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
