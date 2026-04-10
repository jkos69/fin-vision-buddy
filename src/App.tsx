import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { OPEXProvider } from "@/contexts/OPEXContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import AreasPage from "./pages/AreasPage";
import PacotesPage from "./pages/PacotesPage";
import ComparacaoPage from "./pages/ComparacaoPage";
import UploadPage from "./pages/UploadPage";
import SGAPage from "./pages/SGAPage";
import CentroCustoPage from "./pages/CentroCustoPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session } = useAuth();

  if (!session) return <LoginPage />;

  return (
    <OPEXProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/areas" element={<AreasPage />} />
          <Route path="/pacotes" element={<PacotesPage />} />
          <Route path="/comparacao" element={<ComparacaoPage />} />
          <Route path="/centrocusto" element={<CentroCustoPage />} />
          <Route path="/sga" element={<SGAPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </OPEXProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
