import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { supabase, Evento, Inscricao } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, ArrowLeft, Printer, CheckSquare, Square, RefreshCw } from "lucide-react";
import { calcularIdade } from "@/lib/utils";
import { toast } from "sonner";

const FAIXA_COR: Record<string, string> = {
  Branca: "#e5e7eb", Cinza: "#9ca3af", Azul: "#3b82f6", Amarela: "#fbbf24",
  Laranja: "#f97316", Verde: "#22c55e", Roxa: "#a855f7", Marrom: "#92400e", Preta: "#111827",
};

export default function AdminCredenciais() {
  const [, navigate] = useLocation();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSel, setEventoSel] = useState("");
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("eventos").select("*").order("data_inicio").then(({ data }) => {
      setEventos(data ?? []);
      if (data && data.length > 0) setEventoSel(data[0].id);
    });
  }, []);

  useEffect(() => { if (eventoSel) loadInscricoes(); }, [eventoSel]);

  async function loadInscricoes() {
    setLoading(true);
    setSelecionadas(new Set());
    const { data, error } = await supabase
      .from("inscricoes")
      .select("*, categorias(nome), associacoes(nome)")
      .eq("evento_id", eventoSel)
      .eq("status", "confirmado")
      .order("atleta_nome");
    if (error) toast.error("Erro ao carregar inscrições");
    setInscricoes((data ?? []) as Inscricao[]);
    setLoading(false);
  }

  function toggleSel(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelecionadas((prev) =>
      prev.size === inscricoes.length ? new Set() : new Set(inscricoes.map((i) => i.id))
    );
  }

  async function handlePrint() {
    const ids = selecionadas.size > 0 ? Array.from(selecionadas) : inscricoes.map((i) => i.id);
    if (ids.length === 0) { toast.error("Nenhuma inscrição selecionada"); return; }
    setPrinting(true);

    await new Promise((r) => setTimeout(r, 100));
    window.print();

    // Marca como impressas no banco
    await supabase
      .from("inscricoes")
      .update({ sticker_printed: true, sticker_printed_at: new Date().toISOString() })
      .in("id", ids);

    setPrinting(false);
    toast.success(`${ids.length} credencial${ids.length !== 1 ? "is" : ""} marcada${ids.length !== 1 ? "s" : ""} como impressa${ids.length !== 1 ? "s" : ""}`);
    loadInscricoes();
  }

  const paraImprimir = selecionadas.size > 0
    ? inscricoes.filter((i) => selecionadas.has(i.id))
    : inscricoes;

  const evento = eventos.find((e) => e.id === eventoSel);

  return (
    <>
      {/* ── Tela de gerenciamento ────────────────────────────────────── */}
      <div className="min-h-screen bg-gray-50 print:hidden">
        <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-400" />
            <span className="font-black text-lg">Arena</span>
            <span className="text-gray-600 mx-2">·</span>
            <span className="text-gray-400 text-sm">Credenciais</span>
          </div>
          <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Credenciais</h1>
              <p className="text-gray-400 text-sm mt-0.5">Selecione e imprima as credenciais dos atletas</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
              <button onClick={loadInscricoes} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-blue-600 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrint}
                disabled={printing || inscricoes.length === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm"
              >
                {printing ? <Spinner className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
                Imprimir {selecionadas.size > 0 ? `(${selecionadas.size})` : "todas"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
          ) : inscricoes.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Printer className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Nenhuma inscrição confirmada neste evento</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors font-semibold">
                  {selecionadas.size === inscricoes.length
                    ? <CheckSquare className="w-4 h-4 text-blue-600" />
                    : <Square className="w-4 h-4" />}
                  {selecionadas.size === 0 ? "Selecionar todas" : selecionadas.size === inscricoes.length ? "Desmarcar todas" : `${selecionadas.size} selecionadas`}
                </button>
                <span className="text-gray-300">·</span>
                <span className="text-sm text-gray-400">{inscricoes.length} confirmadas · {inscricoes.filter((i) => i.sticker_printed).length} já impressas</span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inscricoes.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => toggleSel(i.id)}
                    className={`text-left bg-white border-2 rounded-xl p-4 transition-all ${selecionadas.has(i.id) ? "border-blue-500 shadow-md" : "border-gray-100 hover:border-gray-200 shadow-sm"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{i.atleta_nome}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{calcularIdade(i.atleta_data_nascimento)} anos · {i.atleta_sexo === "M" ? "M" : "F"}</p>
                        {(i.categorias as any)?.nome && <p className="text-blue-600 text-xs font-medium mt-1">{(i.categorias as any).nome}</p>}
                        {i.atleta_faixa && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: FAIXA_COR[i.atleta_faixa] ?? "#374151", color: i.atleta_faixa === "Branca" || i.atleta_faixa === "Amarela" ? "#111" : "#fff" }}>
                            {i.atleta_faixa}
                          </span>
                        )}
                      </div>
                      {i.sticker_printed && <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full flex-shrink-0">✓ impressa</span>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Layout de impressão — Etiqueta 80×50 mm ─────────────────── */}
      <div ref={printRef} className="hidden print:block">
        <style>{`
          @media print {
            @page { size: 80mm 50mm; margin: 2mm; }
            body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .credential-grid { display: block; }
            .credential-card {
              page-break-after: always;
              break-after: page;
              display: flex;
              flex-direction: column;
              width: 76mm;
              height: 46mm;
              overflow: hidden;
              box-sizing: border-box;
            }
          }
        `}</style>
        <div className="credential-grid">
          {paraImprimir.map((i) => (
            <CredencialCard key={i.id} inscricao={i} eventoNome={evento?.nome ?? ""} />
          ))}
        </div>
      </div>
    </>
  );
}

function CredencialCard({ inscricao: i, eventoNome }: { inscricao: Inscricao; eventoNome: string }) {
  const corFaixa = FAIXA_COR[i.atleta_faixa ?? ""] ?? "#374151";
  const textoFaixa = i.atleta_faixa === "Branca" || i.atleta_faixa === "Amarela" ? "#111827" : "#fff";
  const idade = calcularIdade(i.atleta_data_nascimento);

  return (
    <div
      className="credential-card"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", border: "0.5px solid #cbd5e1", borderRadius: "2mm", background: "#fff" }}
    >
      {/* ── Cabeçalho ── */}
      <div style={{
        background: "#0f172a",
        color: "#fff",
        padding: "1.5mm 3mm",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        borderRadius: "1.5mm 1.5mm 0 0",
      }}>
        <span style={{ fontWeight: 900, fontSize: "7.5pt", letterSpacing: "-0.2px" }}>🏆 Arena</span>
        <span style={{ fontSize: "5.5pt", color: "#93c5fd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55mm" }}>
          {eventoNome}
        </span>
      </div>

      {/* ── Corpo: QR esquerda + dados direita ── */}
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "2mm 3mm", gap: "3mm", flex: 1 }}>

        {/* QR Code */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1mm" }}>
          <QRCodeSVG value={i.check_in_token} size={112} level="M" includeMargin={false} />
          <span style={{ fontSize: "4pt", color: "#cbd5e1", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {i.check_in_token.slice(0, 8)}
          </span>
        </div>

        {/* Dados do atleta */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.5mm", minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: "11pt", color: "#0f172a", lineHeight: 1.1, wordBreak: "break-word" }}>
            {i.atleta_nome}
          </p>

          {(i.categorias as any)?.nome && (
            <p style={{ margin: 0, fontSize: "7.5pt", color: "#1d4ed8", fontWeight: 700 }}>
              {(i.categorias as any).nome}
            </p>
          )}

          <p style={{ margin: 0, fontSize: "6.5pt", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(i.associacoes as any)?.nome ?? ""}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5mm", alignItems: "center" }}>
            <span style={{ fontSize: "6pt", background: "#f1f5f9", color: "#475569", padding: "0.5mm 2mm", borderRadius: "999px", fontWeight: 600 }}>
              {i.atleta_sexo === "M" ? "Masc." : "Fem."} · {idade}a
            </span>
            {i.atleta_faixa && (
              <span style={{ fontSize: "6pt", fontWeight: 700, background: corFaixa, color: textoFaixa, padding: "0.5mm 2.5mm", borderRadius: "999px", whiteSpace: "nowrap" }}>
                {i.atleta_faixa}
              </span>
            )}
            {i.atleta_peso && (
              <span style={{ fontSize: "6pt", background: "#f1f5f9", color: "#475569", padding: "0.5mm 2mm", borderRadius: "999px", fontWeight: 600 }}>
                {i.atleta_peso} kg
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
