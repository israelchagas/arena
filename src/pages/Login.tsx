import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Login() {
  const { signIn, profile } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redireciona se já logado
  if (profile) {
    navigate(profile.role === "admin" || profile.role === "staff" ? "/admin" : "/professor");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setError("E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.");
      setLoading(false);
    }
    // onAuthStateChange cuidará do redirecionamento via App.tsx
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Painel esquerdo (branding) ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#1d4ed8] flex-col justify-between p-12 relative overflow-hidden">
        {/* Círculos decorativos */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-black text-xl leading-none">Arena</p>
            <p className="text-blue-300 text-xs">Gestão de Eventos Esportivos</p>
          </div>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white leading-tight mb-6">
            Do tatame à<br />
            <span className="text-blue-300">gestão completa</span>
          </h1>
          <p className="text-blue-200 text-lg leading-relaxed mb-10 max-w-sm">
            Inscrições, check-in e certificados em uma plataforma pensada para eventos esportivos de qualquer modalidade.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Inscrições", value: "Online" },
              { label: "Check-in", value: "QR Code" },
              { label: "Certificado", value: "Self-service" },
            ].map((item) => (
              <div key={item.label} className="bg-white/10 border border-white/15 rounded-xl p-4">
                <p className="text-white font-bold text-sm">{item.value}</p>
                <p className="text-blue-300 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <p className="relative z-10 text-blue-400 text-xs">
          © {new Date().getFullYear()} Arena. Plataforma de Eventos Esportivos.
        </p>
      </div>

      {/* ── Painel direito (formulário) ────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Header mobile */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-gray-900 text-lg">Arena</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-black text-gray-900 mb-1">Bem-vindo de volta</h2>
            <p className="text-gray-500 text-sm mb-8">
              Entre com suas credenciais para acessar o painel.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* E-mail */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Entrando...
                  </>
                ) : (
                  "Entrar na plataforma"
                )}
              </button>
            </form>

            {/* Ajuda */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-center text-xs text-gray-400">
                Não recebeu seu acesso?{" "}
                <a href="mailto:suporte@arena.esporte" className="text-blue-600 font-semibold hover:underline">
                  Contate o organizador
                </a>
              </p>
            </div>
          </div>

          {/* Dica */}
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-600 text-xs font-bold">i</span>
            </div>
            <p className="text-blue-700 text-xs leading-relaxed">
              Seu acesso foi enviado por e-mail pelo organizador do evento.
              Verifique sua caixa de entrada e spam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
