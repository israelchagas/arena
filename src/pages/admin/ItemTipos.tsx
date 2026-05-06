import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase, Evento } from "@/lib/supabase";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, ArrowLeft, Package, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

interface ItemTipo {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export default function AdminItemTipos() {
  const [, navigate] = useLocation();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [itens, setItens] = useState<ItemTipo[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("eventos")
      .select("id, nome, data_inicio, data_fim, local, cidade, uf, status, modalidade, created_at")
      .order("data_inicio", { ascending: false })
      .then(({ data }) => {
        const evs = (data ?? []) as Evento[];
        setEventos(evs);
        if (evs.length) setEventoId(evs[0].id);
      });
  }, []);

  useEffect(() => {
    if (!eventoId) return;
    loadItens();
  }, [eventoId]);

  async function loadItens() {
    setLoadingItens(true);
    const { data } = await supabase
      .from("item_tipos")
      .select("id, nome, ordem, ativo")
      .eq("evento_id", eventoId)
      .order("ordem");
    setItens(data ?? []);
    setLoadingItens(false);
  }

  async function addItem() {
    const nome = novoNome.trim();
    if (!nome || !eventoId) return;
    setSaving(true);
    const ordem = itens.length > 0 ? Math.max(...itens.map((i) => i.ordem)) + 1 : 0;
    const { error } = await supabase
      .from("item_tipos")
      .insert({ evento_id: eventoId, nome, ordem, ativo: true });
    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
    } else {
      setNovoNome("");
      await loadItens();
      toast.success("Item adicionado!");
    }
    setSaving(false);
  }

  async function deleteItem(id: string) {
    if (!confirm("Remover este item? As retiradas já registradas serão mantidas.")) return;
    setDeleting(id);
    const { error } = await supabase.from("item_tipos").delete().eq("id", id);
    if (error) toast.error("Erro ao remover: " + error.message);
    else { toast.success("Item removido"); await loadItens(); }
    setDeleting(null);
  }

  async function moveItem(id: string, dir: "up" | "down") {
    const idx = itens.findIndex((i) => i.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === itens.length - 1) return;
    const swap = dir === "up" ? idx - 1 : idx + 1;
    const next = [...itens];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItens(next.map((item, i) => ({ ...item, ordem: i })));
    await Promise.all(
      next.map((item, i) => supabase.from("item_tipos").update({ ordem: i }).eq("id", item.id))
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Itens para Retirada</span>
        </div>
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Itens para Retirada</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure os itens que cada atleta deve retirar. A entrega exige leitura de QR Code por item.
          </p>
        </div>

        {/* Seletor de evento */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Evento</label>
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione o evento</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>

        {eventoId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Adicionar item */}
            <div className="p-5 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Novo item</p>
              <div className="flex gap-3">
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="Ex: Camiseta, Medalha, Kit do Atleta..."
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                <button
                  onClick={addItem}
                  disabled={saving || !novoNome.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all"
                >
                  {saving ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  Adicionar
                </button>
              </div>
            </div>

            {/* Lista de itens */}
            {loadingItens ? (
              <div className="flex justify-center py-12">
                <Spinner className="w-7 h-7 text-blue-600" />
              </div>
            ) : itens.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium text-sm">Nenhum item configurado</p>
                <p className="text-gray-300 text-xs mt-1">Adicione itens acima para começar</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {itens.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    {/* Reordenar */}
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveItem(item.id, "up")}
                        disabled={idx === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveItem(item.id, "down")}
                        disabled={idx === itens.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <span className="text-xs font-black text-gray-200 w-5 text-center">{idx + 1}</span>
                    <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="flex-1 font-semibold text-gray-900 text-sm">{item.nome}</span>

                    <button
                      onClick={() => deleteItem(item.id)}
                      disabled={deleting === item.id}
                      className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      {deleting === item.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm font-bold text-blue-800 mb-1">Como funciona</p>
          <ul className="text-xs text-blue-600 space-y-1 leading-relaxed">
            <li>• O staff acessa <strong>/retirada</strong> no tablet/celular</li>
            <li>• Escaneia o QR Code da credencial do atleta</li>
            <li>• Para cada item pendente, clica em "Entregar" e escaneia o QR novamente para confirmar</li>
            <li>• O sistema registra data/hora de cada entrega individualmente</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
