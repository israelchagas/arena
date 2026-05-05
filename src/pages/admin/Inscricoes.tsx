import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase, Inscricao, Evento } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, ClipboardList, ArrowLeft, Search, CheckCircle,
  XCircle, Clock, User, Calendar, Download,
} from "lucide-react";
import { calcularIdade, formatDateLong } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CFG = {
  confirmado: { label: "Confirmado", cls: "bg-green-100 text-green-700", Icon: CheckCircle },
  pendente:   { label: "Pendente",   cls: "bg-amber-100 text-amber-700",  Icon: Clock },
  cancelado:  { label: "Cancelado",  cls: "bg-red-100 text-red-600",      Icon: XCircle },
};

export default function AdminInscricoes() {
  const [, navigate] = useLocation();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [eventos, setEventos] = useState<Pick<Evento, "id" | "nome">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventoFiltro, setEventoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [inscRes, evRes] = await Promise.all([
      supabase
        .from("inscricoes")
        .select("*, categorias(nome), associacoes(nome), professores(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("eventos").select("id, nome").order("data_inicio"),
    ]);
    if (inscRes.error) toast.error("Erro ao carregar inscrições");
    setInscricoes((inscRes.data ?? []) as Inscricao[]);
    setEventos(evRes.data ?? []);
    setLoading(false);
  }

  async function alterarStatus(id: string, status: "confirmado" | "cancelado" | "pendente") {
    const { error } = await supabase.from("inscricoes").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status");
    else {
      toast.success("Status atualizado");
      setInscricoes((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  const filtered = inscricoes.filter((i) => {
    const matchSearch = !search || i.atleta_nome.toLowerCase().includes(search.toLowerCase());
    const matchEvento = eventoFiltro === "todos" || i.evento_id === eventoFiltro;
    const matchStatus = statusFiltro === "todos" || i.status === statusFiltro;
    return matchSearch && matchEvento && matchStatus;
  });

  const totais = {
    confirmado: inscricoes.filter((i) => i.status === "confirmado").length,
    pendente: inscricoes.filter((i) => i.status === "pendente").length,
    cancelado: inscricoes.filter((i) => i.status === "cancelado").length,
  };

  function exportCSV() {
    const header = "Nome,Data Nasc.,Idade,Sexo,Faixa,Peso,Categoria,Associação,Professor,Status";
    const rows = filtered.map((i) => [
      i.atleta_nome,
      i.atleta_data_nascimento,
      calcularIdade(i.atleta_data_nascimento),
      i.atleta_sexo === "M" ? "Masculino" : "Feminino",
      i.atleta_faixa ?? "",
      i.atleta_peso ?? "",
      (i.categorias as any)?.nome ?? "",
      (i.associacoes as any)?.nome ?? "",
      (i.professores as any)?.nome ?? "",
      i.status,
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inscricoes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Inscrições</span>
        </div>
        <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Totais */}
        <div className="grid grid-cols-3 gap-4">
          {(["confirmado", "pendente", "cancelado"] as const).map((s) => {
            const cfg = STATUS_CFG[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFiltro(statusFiltro === s ? "todos" : s)}
                className={`bg-white border rounded-2xl p-4 shadow-sm text-left transition-all hover:shadow-md ${statusFiltro === s ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-100"}`}
              >
                <p className="text-2xl font-black text-gray-900">{totais[s]}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${cfg.cls}`}>
                  <cfg.Icon className="w-3 h-3" />{cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atleta..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={eventoFiltro} onChange={(e) => setEventoFiltro(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos os eventos</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all font-semibold">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Nenhuma inscrição encontrada</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-500">{filtered.length} inscrição{filtered.length !== 1 ? "ões" : ""}</p>
            </div>
            <div className="divide-y divide-gray-50">
              {filtered.map((i) => {
                const st = STATUS_CFG[i.status];
                return (
                  <div key={i.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{i.atleta_nome}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {calcularIdade(i.atleta_data_nascimento)} anos
                          </span>
                          <span>{i.atleta_sexo === "M" ? "Masculino" : "Feminino"}</span>
                          {i.atleta_faixa && <span className="text-purple-600 font-medium">{i.atleta_faixa}</span>}
                          {(i.categorias as any)?.nome && <span className="text-blue-500">{(i.categorias as any).nome}</span>}
                          {(i.associacoes as any)?.nome && <span>{(i.associacoes as any).nome}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                        <st.Icon className="w-3 h-3" />{st.label}
                      </span>
                      <select
                        value={i.status}
                        onChange={(e) => alterarStatus(i.id, e.target.value as any)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="confirmado">Confirmar</option>
                        <option value="pendente">Pendente</option>
                        <option value="cancelado">Cancelar</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
