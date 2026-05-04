import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase, Evento } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, BarChart2, ArrowLeft, Users, ClipboardList,
  CheckCircle, XCircle, TrendingUp, Download,
} from "lucide-react";
import { formatDateLong } from "@/lib/utils";
import { toast } from "sonner";

interface EventoStats {
  evento: Evento;
  total: number;
  confirmados: number;
  cancelados: number;
  pendentes: number;
  checkins: number;
  professores: number;
  associacoes: number;
  porCategoria: { nome: string; total: number }[];
  porAssociacao: { nome: string; total: number }[];
}

export default function AdminRelatorios() {
  const [, navigate] = useLocation();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSel, setEventoSel] = useState<string>("");
  const [stats, setStats] = useState<EventoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEventos, setLoadingEventos] = useState(true);

  useEffect(() => {
    supabase.from("eventos").select("*").order("data_inicio").then(({ data }) => {
      const list = data ?? [];
      setEventos(list);
      if (list.length > 0) setEventoSel(list[0].id);
      setLoadingEventos(false);
    });
  }, []);

  useEffect(() => {
    if (eventoSel) loadStats(eventoSel);
  }, [eventoSel]);

  async function loadStats(eventoId: string) {
    setLoading(true);
    setStats(null);

    const evento = eventos.find((e) => e.id === eventoId)!;
    if (!evento) { setLoading(false); return; }

    const [inscRes, chkRes, profRes, assocRes] = await Promise.all([
      supabase.from("inscricoes").select("id, status, categoria_id, associacao_id, categorias(nome), associacoes(nome)").eq("evento_id", eventoId),
      supabase.from("checkins").select("id", { count: "exact", head: true }).eq("evento_id", eventoId),
      supabase.from("professores").select("id", { count: "exact", head: true }).eq("evento_id", eventoId),
      supabase.from("associacoes").select("id", { count: "exact", head: true }).eq("evento_id", eventoId),
    ]);

    if (inscRes.error) { toast.error("Erro ao carregar relatório"); setLoading(false); return; }

    const insc = inscRes.data ?? [];
    const confirmados = insc.filter((i) => i.status === "confirmado").length;
    const cancelados = insc.filter((i) => i.status === "cancelado").length;
    const pendentes = insc.filter((i) => i.status === "pendente").length;

    const catMap: Record<string, number> = {};
    const assocMap: Record<string, number> = {};
    for (const i of insc) {
      const cat = (i.categorias as any)?.nome ?? "Sem categoria";
      const assoc = (i.associacoes as any)?.nome ?? "Sem associação";
      catMap[cat] = (catMap[cat] ?? 0) + 1;
      assocMap[assoc] = (assocMap[assoc] ?? 0) + 1;
    }

    const porCategoria = Object.entries(catMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
    const porAssociacao = Object.entries(assocMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

    setStats({
      evento,
      total: insc.length,
      confirmados,
      cancelados,
      pendentes,
      checkins: chkRes.count ?? 0,
      professores: profRes.count ?? 0,
      associacoes: assocRes.count ?? 0,
      porCategoria,
      porAssociacao,
    });
    setLoading(false);
  }

  function exportCSV() {
    if (!stats) return;
    const lines = [
      `Relatório — ${stats.evento.nome}`,
      `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`,
      "",
      "TOTAIS",
      `Total de inscrições,${stats.total}`,
      `Confirmados,${stats.confirmados}`,
      `Pendentes,${stats.pendentes}`,
      `Cancelados,${stats.cancelados}`,
      `Check-ins realizados,${stats.checkins}`,
      `Professores,${stats.professores}`,
      `Associações,${stats.associacoes}`,
      "",
      "POR CATEGORIA",
      ...stats.porCategoria.map((c) => `${c.nome},${c.total}`),
      "",
      "POR ASSOCIAÇÃO",
      ...stats.porAssociacao.map((a) => `${a.nome},${a.total}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${stats.evento.nome.replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Relatórios</span>
        </div>
        <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Relatórios</h1>
            <p className="text-gray-400 text-sm mt-0.5">Visão consolidada por evento</p>
          </div>
          {stats && (
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all font-semibold shadow-sm">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          )}
        </div>

        {/* Seletor de evento */}
        {loadingEventos ? (
          <div className="flex justify-center py-10"><Spinner className="w-6 h-6 text-blue-600" /></div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Nenhum evento cadastrado</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {eventos.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setEventoSel(e.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${eventoSel === e.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
                >
                  {e.nome}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Info do evento */}
                <div className="bg-[#0f172a] text-white rounded-2xl p-6">
                  <h2 className="font-black text-xl">{stats.evento.nome}</h2>
                  <p className="text-blue-300 text-sm mt-1">{formatDateLong(stats.evento.data_inicio)} · {stats.evento.local}</p>
                </div>

                {/* Cards de totais */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Total inscrições", value: stats.total, Icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
                    { label: "Confirmados", value: stats.confirmados, Icon: CheckCircle, color: "text-green-600 bg-green-50" },
                    { label: "Check-ins", value: stats.checkins, Icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
                    { label: "Cancelados", value: stats.cancelados, Icon: XCircle, color: "text-red-500 bg-red-50" },
                  ].map((c) => (
                    <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
                        <c.Icon className="w-4 h-4" />
                      </div>
                      <p className="text-3xl font-black text-gray-900">{c.value}</p>
                      <p className="text-gray-400 text-xs mt-1">{c.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Por categoria */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Por Categoria</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      {stats.porCategoria.length === 0 ? (
                        <p className="text-gray-400 text-sm">Sem dados</p>
                      ) : stats.porCategoria.map((c) => (
                        <div key={c.nome}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">{c.nome}</span>
                            <span className="text-gray-500 font-semibold">{c.total}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${Math.round((c.total / stats.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Por associação */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-50">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-purple-500" /> Por Associação</h3>
                    </div>
                    <div className="p-5 space-y-3">
                      {stats.porAssociacao.length === 0 ? (
                        <p className="text-gray-400 text-sm">Sem dados</p>
                      ) : stats.porAssociacao.map((a) => (
                        <div key={a.nome}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">{a.nome}</span>
                            <span className="text-gray-500 font-semibold">{a.total}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all"
                              style={{ width: `${Math.round((a.total / stats.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Métricas secundárias */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-black text-gray-900">{stats.professores}</p>
                    <p className="text-gray-400 text-sm mt-1">Professores participantes</p>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-3xl font-black text-gray-900">{stats.associacoes}</p>
                    <p className="text-gray-400 text-sm mt-1">Associações inscritas</p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
