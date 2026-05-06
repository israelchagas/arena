import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, Users, ClipboardList, LogOut, Calendar, ChevronRight, BarChart2, BadgeCheck, QrCode, Package } from "lucide-react";
import { formatDateLong } from "@/lib/utils";

interface Stats {
  eventos: number;
  inscricoes: number;
  professores: number;
  checkins: number;
}

interface EventoResumo {
  id: string;
  nome: string;
  data_inicio: string;
  status: string;
  _count: number;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<Stats>({ eventos: 0, inscricoes: 0, professores: 0, checkins: 0 });
  const [eventos, setEventos] = useState<EventoResumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [ev, insc, prof, chk] = await Promise.all([
      supabase.from("eventos").select("*", { count: "exact", head: true }),
      supabase.from("inscricoes").select("*", { count: "exact", head: true }),
      supabase.from("professores").select("*", { count: "exact", head: true }),
      supabase.from("checkins").select("*", { count: "exact", head: true }),
    ]);

    setStats({
      eventos: ev.count ?? 0,
      inscricoes: insc.count ?? 0,
      professores: prof.count ?? 0,
      checkins: chk.count ?? 0,
    });

    const { data: evList } = await supabase
      .from("eventos")
      .select("id, nome, data_inicio, status")
      .order("data_inicio", { ascending: true })
      .limit(5);

    setEventos((evList ?? []) as EventoResumo[]);
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner className="w-8 h-8 text-blue-600" />
    </div>
  );

  const menuItems = [
    { label: "Eventos", icon: Calendar, path: "/admin/eventos", color: "text-blue-600 bg-blue-50" },
    { label: "Professores", icon: Users, path: "/admin/professores", color: "text-purple-600 bg-purple-50" },
    { label: "Inscrições", icon: ClipboardList, path: "/admin/inscricoes", color: "text-green-600 bg-green-50" },
    { label: "Credenciais", icon: BadgeCheck, path: "/admin/credenciais", color: "text-rose-600 bg-rose-50" },
    { label: "Check-in", icon: QrCode, path: "/checkin", color: "text-cyan-600 bg-cyan-50" },
    { label: "Retirada de Itens", icon: Package, path: "/retirada", color: "text-orange-600 bg-orange-50" },
    { label: "Itens p/ Retirada", icon: Package, path: "/admin/itens", color: "text-indigo-600 bg-indigo-50" },
    { label: "Relatórios", icon: BarChart2, path: "/admin/relatorios", color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Painel Administrativo</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{profile?.nome}</span>
          <button onClick={async () => { await signOut(); navigate("/login"); }} className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Visão Geral</h1>
          <p className="text-gray-400 text-sm mt-1">Bem-vindo, {profile?.nome}.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Eventos", value: stats.eventos, icon: Calendar, color: "blue" },
            { label: "Inscrições", value: stats.inscricoes, icon: ClipboardList, color: "green" },
            { label: "Professores", value: stats.professores, icon: Users, color: "purple" },
            { label: "Check-ins", value: stats.checkins, icon: Trophy, color: "amber" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-3xl font-black text-gray-900">{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Menu */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <p className="font-bold text-gray-900 text-sm">{item.label}</p>
              <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs group-hover:text-blue-600 transition-colors">
                Gerenciar <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>

        {/* Próximos eventos */}
        {eventos.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900">Próximos Eventos</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {eventos.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{ev.nome}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{formatDateLong(ev.data_inicio)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    ev.status === "aberto" ? "bg-green-100 text-green-700" :
                    ev.status === "encerrado" ? "bg-gray-100 text-gray-500" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {ev.status === "aberto" ? "Aberto" : ev.status === "encerrado" ? "Encerrado" : "Rascunho"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
