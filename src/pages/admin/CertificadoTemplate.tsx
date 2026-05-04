import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { CertTemplate, TemplateElement, DEFAULT_TEMPLATE, VARIABLES, newElement } from "@/lib/certificadoTemplate";
import { CertificadoRenderer } from "@/components/CertificadoRenderer";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, ArrowLeft, Save, Plus, Trash2, RotateCcw,
  Type, AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronUp, Eye,
} from "lucide-react";
import { toast } from "sonner";

const FONTS = ["Arial, sans-serif", "Georgia, serif", "Times New Roman, serif", "'Courier New', monospace", "Verdana, sans-serif"];
const PREVIEW_SCALE = 0.42;
const PX_PER_MM = 3.7795;

const DEMO_VARS: Record<string, string> = {
  "{{atleta_nome}}": "João da Silva",
  "{{evento_nome}}": "Festival de Judô 2025",
  "{{data_evento}}": "20 de setembro de 2025",
  "{{local}}": "Ginásio Municipal",
  "{{cidade}}": "Brasília/DF",
  "{{categoria}}": "Sub-13 Masculino",
  "{{associacao}}": "Associação Cultura de Campeões",
  "{{faixa}}": "Azul",
  "{{modalidade}}": "Judô",
};

export default function AdminCertificadoTemplate() {
  const [, params] = useRoute<{ eventoId: string }>("/admin/certificado/:eventoId");
  const [, navigate] = useLocation();
  const eventoId = params?.eventoId ?? "";

  const [eventoNome, setEventoNome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [template, setTemplate] = useState<CertTemplate>(DEFAULT_TEMPLATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const selected = template.elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => { if (eventoId) loadEvento(); }, [eventoId]);

  async function loadEvento() {
    setLoading(true);
    const { data } = await supabase.from("eventos").select("nome, logo_url, certificado_template").eq("id", eventoId).single();
    if (data) {
      setEventoNome(data.nome);
      setLogoUrl(data.logo_url ?? undefined);
      if (data.certificado_template) setTemplate(data.certificado_template as CertTemplate);
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("eventos").update({ certificado_template: template }).eq("id", eventoId);
    if (error) toast.error("Erro ao salvar template");
    else toast.success("Template salvo!");
    setSaving(false);
  }

  function updateElement(id: string, patch: Partial<TemplateElement>) {
    setTemplate((t) => ({ ...t, elements: t.elements.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  }

  function deleteElement(id: string) {
    setTemplate((t) => ({ ...t, elements: t.elements.filter((e) => e.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function addElement() {
    const el = newElement();
    setTemplate((t) => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
  }

  function moveElement(id: string, dir: "up" | "down") {
    setTemplate((t) => {
      const els = [...t.elements];
      const i = els.findIndex((e) => e.id === id);
      if (dir === "up" && i > 0) [els[i - 1], els[i]] = [els[i], els[i - 1]];
      if (dir === "down" && i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
      return { ...t, elements: els };
    });
  }

  function resetTemplate() {
    if (!confirm("Restaurar o template padrão? As alterações serão perdidas.")) return;
    setTemplate(DEFAULT_TEMPLATE);
    setSelectedId(null);
  }

  function importJSON() {
    const input = prompt("Cole o JSON do template:");
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      // Adapta o JSON do usuário: garante ids e campos obrigatórios
      const adapted: CertTemplate = {
        paper: parsed.paper ?? DEFAULT_TEMPLATE.paper,
        background: parsed.background ?? DEFAULT_TEMPLATE.background,
        elements: (parsed.elements ?? []).map((el: any, i: number) => ({
          id: el.id ?? String(i + 1),
          type: "text",
          text: el.text ?? "",
          x_mm: el.x_mm ?? 210,
          y_mm: el.y_mm ?? 50 + i * 30,
          font_size_pt: el.font_size_pt ?? 14,
          font_family: el.font_family ?? "Arial, sans-serif",
          font_weight: el.font_weight ?? "normal",
          font_style: el.font_style,
          alignment: el.alignment ?? "center",
          color: el.color ?? "#000000",
          line_height: el.line_height,
        })),
      };
      setTemplate(adapted);
      setSelectedId(null);
      toast.success(`${adapted.elements.length} elementos importados`);
    } catch {
      toast.error("JSON inválido");
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Spinner className="w-8 h-8 text-blue-600" />
    </div>
  );

  const previewW = template.paper.width_mm * PX_PER_MM * PREVIEW_SCALE;
  const previewH = template.paper.height_mm * PX_PER_MM * PREVIEW_SCALE;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#0f172a] text-white px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-blue-400" />
          <span className="font-black">Arena</span>
          <span className="text-gray-600 mx-1">·</span>
          <span className="text-gray-400 text-sm">Certificado</span>
          <span className="text-gray-600 mx-1">·</span>
          <span className="text-white text-sm font-medium truncate max-w-48">{eventoNome}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={importJSON} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all font-medium">
            Importar JSON
          </button>
          <button onClick={resetTemplate} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
            <RotateCcw className="w-3.5 h-3.5" /> Resetar
          </button>
          <button onClick={() => setPreviewMode(!previewMode)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${previewMode ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}>
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-all">
            {saving ? <Spinner className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
          <button onClick={() => navigate("/admin/eventos")} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors ml-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Painel esquerdo — elementos ─────────────────────── */}
        {!previewMode && (
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Elementos</p>
              <button onClick={addElement} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
              {template.elements.map((el, i) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedId(el.id === selectedId ? null : el.id)}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${el.id === selectedId ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"}`}
                >
                  <Type className={`w-3.5 h-3.5 flex-shrink-0 ${el.id === selectedId ? "text-blue-600" : "text-gray-400"}`} />
                  <span className="text-xs text-gray-700 truncate flex-1">{el.text.length > 28 ? el.text.slice(0, 28) + "…" : el.text}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); moveElement(el.id, "up"); }} disabled={i === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveElement(el.id, "down"); }} disabled={i === template.elements.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="p-0.5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Fundo */}
            <div className="border-t border-gray-100 px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fundo</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16 flex-shrink-0">Cor fundo</label>
                <input type="color" value={template.background.color} onChange={(e) => setTemplate((t) => ({ ...t, background: { ...t.background, color: e.target.value } }))} className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
                <input value={template.background.color} onChange={(e) => setTemplate((t) => ({ ...t, background: { ...t.background, color: e.target.value } }))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 font-mono" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16 flex-shrink-0">Borda</label>
                <input type="color" value={template.background.border_color ?? "#000000"} onChange={(e) => setTemplate((t) => ({ ...t, background: { ...t.background, border_color: e.target.value } }))} className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
                <input type="number" value={template.background.border_width_mm ?? 0} min={0} max={20} onChange={(e) => setTemplate((t) => ({ ...t, background: { ...t.background, border_width_mm: Number(e.target.value) } }))} className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1" />
                <span className="text-xs text-gray-400">mm</span>
              </div>
            </div>
          </aside>
        )}

        {/* ── Centro — preview ────────────────────────────────── */}
        <main className="flex-1 overflow-auto flex items-start justify-center p-8 bg-gray-200">
          <div style={{ width: previewW, height: previewH, position: "relative", flexShrink: 0 }}>
            <CertificadoRenderer
              template={template}
              variables={DEMO_VARS}
              scale={PREVIEW_SCALE}
              selectedId={previewMode ? undefined : selectedId}
              onSelect={previewMode ? undefined : setSelectedId}
              logoUrl={logoUrl}
            />
          </div>
        </main>

        {/* ── Painel direito — propriedades ───────────────────── */}
        {!previewMode && (
          <aside className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Propriedades</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {/* Texto */}
                  <Prop label="Texto">
                    <textarea
                      value={selected.text}
                      onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                    />
                    <button
                      onClick={() => setShowVars(!showVars)}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      {showVars ? "Ocultar variáveis" : "Ver variáveis disponíveis →"}
                    </button>
                    {showVars && (
                      <div className="mt-2 space-y-1">
                        {VARIABLES.map((v) => (
                          <button
                            key={v.key}
                            onClick={() => updateElement(selected.id, { text: selected.text + v.key })}
                            className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
                          >
                            <span className="text-xs font-mono text-blue-700">{v.key}</span>
                            <span className="text-xs text-gray-400">{v.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </Prop>

                  {/* Posição */}
                  <Prop label="Posição (mm)">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">X</label>
                        <input type="number" value={selected.x_mm} onChange={(e) => updateElement(selected.id, { x_mm: Number(e.target.value) })} className={numInp()} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">Y</label>
                        <input type="number" value={selected.y_mm} onChange={(e) => updateElement(selected.id, { y_mm: Number(e.target.value) })} className={numInp()} />
                      </div>
                    </div>
                  </Prop>

                  {/* Fonte */}
                  <Prop label="Fonte">
                    <select value={selected.font_family} onChange={(e) => updateElement(selected.id, { font_family: e.target.value })} className={selInp()}>
                      {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f.split(",")[0]}</option>)}
                    </select>
                  </Prop>

                  {/* Tamanho e peso */}
                  <div className="grid grid-cols-2 gap-2">
                    <Prop label="Tamanho (pt)">
                      <input type="number" min={6} max={72} value={selected.font_size_pt} onChange={(e) => updateElement(selected.id, { font_size_pt: Number(e.target.value) })} className={numInp()} />
                    </Prop>
                    <Prop label="Estilo">
                      <div className="flex gap-1">
                        <button onClick={() => updateElement(selected.id, { font_weight: selected.font_weight === "bold" ? "normal" : "bold" })} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${selected.font_weight === "bold" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>B</button>
                        <button onClick={() => updateElement(selected.id, { font_style: selected.font_style === "italic" ? "normal" : "italic" })} className={`flex-1 py-1.5 rounded-lg text-xs italic border transition-all ${selected.font_style === "italic" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>I</button>
                      </div>
                    </Prop>
                  </div>

                  {/* Alinhamento */}
                  <Prop label="Alinhamento">
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as const).map((a) => {
                        const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                        return (
                          <button key={a} onClick={() => updateElement(selected.id, { alignment: a })} className={`flex-1 py-2 rounded-xl border flex items-center justify-center transition-all ${selected.alignment === a ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}>
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </Prop>

                  {/* Cor */}
                  <Prop label="Cor do texto">
                    <div className="flex gap-2">
                      <input type="color" value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="w-10 h-9 rounded-lg cursor-pointer border border-gray-200 flex-shrink-0" />
                      <input value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </Prop>

                  {/* Espaçamento */}
                  <Prop label="Espaç. entre linhas">
                    <input type="number" step="0.1" min="1" max="3" value={selected.line_height ?? 1.2} onChange={(e) => updateElement(selected.id, { line_height: Number(e.target.value) })} className={numInp()} />
                  </Prop>

                  <button onClick={() => deleteElement(selected.id)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-all mt-2">
                    <Trash2 className="w-4 h-4" /> Remover elemento
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <Type className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-semibold">Selecione um elemento</p>
                <p className="text-xs mt-1">Clique em um texto no preview ou na lista</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
function numInp() { return "w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"; }
function selInp() { return "w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"; }
