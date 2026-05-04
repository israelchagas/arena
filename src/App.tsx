import { Toaster } from "sonner";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

// Pages
import Login from "@/pages/Login";
import ProfessorDashboard from "@/pages/professor/Dashboard";
import NovaInscricao from "@/pages/professor/NovaInscricao";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminEventos from "@/pages/admin/Eventos";
import AdminProfessores from "@/pages/admin/Professores";
import AdminInscricoes from "@/pages/admin/Inscricoes";
import AdminRelatorios from "@/pages/admin/Relatorios";
import AdminCredenciais from "@/pages/admin/Credenciais";
import AdminCertificadoTemplate from "@/pages/admin/CertificadoTemplate";
import CheckIn from "@/pages/CheckIn";
import Certificado from "@/pages/Certificado";
import CadastroProfessor from "@/pages/CadastroProfessor";
import InscricaoPublica from "@/pages/InscricaoPublica";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, retry: 1 } },
});

// ── Rota protegida ───────────────────────────────────────────────────────────

function ProtectedRoute({
  component: Component,
  roles,
}: {
  component: React.ComponentType;
  roles?: ("admin" | "staff" | "professor")[];
}) {
  const { profile, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !profile) navigate("/login");
    if (!loading && profile && roles && !roles.includes(profile.role)) {
      navigate(profile.role === "professor" ? "/professor" : "/admin");
    }
  }, [loading, profile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="w-8 h-8 text-blue-600" />
      </div>
    );
  }

  if (!profile) return null;
  return <Component />;
}

// ── Router ───────────────────────────────────────────────────────────────────

// Rotas que não devem disparar redirect automático (públicas ou já protegidas)
const SKIP_REDIRECT = ["/login", "/professor", "/admin", "/checkin", "/certificado", "/cadastro", "/inscrever"];

function AppRouter() {
  const { profile, loading } = useAuth();
  const [location, navigate] = useLocation();

  // Redireciona apenas quando o usuário está na raiz ou em rota desconhecida
  useEffect(() => {
    if (!loading && profile) {
      const isKnown = SKIP_REDIRECT.some((p) => location.startsWith(p));
      if (!isKnown) {
        navigate(profile.role === "professor" ? "/professor" : "/admin");
      }
    }
  }, [loading, profile, location]);

  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Professor */}
      <Route path="/professor">
        <ProtectedRoute component={ProfessorDashboard} roles={["professor"]} />
      </Route>
      <Route path="/professor/nova-inscricao">
        <ProtectedRoute component={NovaInscricao} roles={["professor"]} />
      </Route>

      {/* Admin / Staff */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/eventos">
        <ProtectedRoute component={AdminEventos} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/professores">
        <ProtectedRoute component={AdminProfessores} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/inscricoes">
        <ProtectedRoute component={AdminInscricoes} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/relatorios">
        <ProtectedRoute component={AdminRelatorios} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/credenciais">
        <ProtectedRoute component={AdminCredenciais} roles={["admin", "staff"]} />
      </Route>
      <Route path="/admin/certificado/:eventoId">
        <ProtectedRoute component={AdminCertificadoTemplate} roles={["admin"]} />
      </Route>

      {/* Check-in — staff/tablet */}
      <Route path="/checkin">
        <ProtectedRoute component={CheckIn} roles={["admin", "staff"]} />
      </Route>

      {/* Certificado — público */}
      <Route path="/certificado/:token" component={Certificado} />

      {/* Cadastro público de professor */}
      <Route path="/cadastro" component={CadastroProfessor} />

      {/* Inscrição pública de atleta via link do professor */}
      <Route path="/inscrever/:professorId" component={InscricaoPublica} />

      {/* Fallback */}
      <Route>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Spinner className="w-8 h-8 text-blue-600" />
          </div>
        ) : (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Redirecionando...</p>
            </div>
          </div>
        )}
      </Route>
    </Switch>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
