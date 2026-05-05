import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, Printer, XCircle, Clock, AlertTriangle } from "lucide-react";
import { formatDateLong } from "@/lib/utils";
import { CertTemplate, DEFAULT_TEMPLATE, applyVariables } from "@/lib/certificadoTemplate";
import { CertificadoRenderer } from "@/components/CertificadoRenderer";

interface CertData {
  atleta_nome: string;
  atleta_faixa?: string;
  atleta_sexo?: string;
  categoria: string;
  associacao: string;
  evento_nome: string;
  evento_data_inicio: string;
  evento_data_fim: string;
  evento_local: string;
  evento_cidade: string;
  evento_uf: string;
  modalidade: string;
  logo_url?: string;
  template: CertTemplate;
}

export default function Certificado() {
  const [, params] = useRoute<{ token: string }>("/certificado/:token");
  const token = params?.token ?? "";

  const [state, setState] = useState<"loading" | "ok" | "no-checkin" | "not-found" | "evento-aberto">("loading");
  const [cert, setCert] = useState<CertData | null>(null);

  useEffect(() => { if (token) loadCert(); }, [token]);

  async function loadCert() {
    setState("loading");
    const { data: insc, error } = await supabase
      .from("inscricoes")
      .select(`
        atleta_nome, atleta_data_nascimento, atleta_sexo, atleta_faixa,
        categorias(nome),
        associacoes(nome),
        eventos(nome, data_inicio, data_fim, local, cidade, uf, modalidade, logo_url, status, certificado_template),
        checkins(realizado_em)
      `)
      .eq("check_in_token", token)
      .single();

    if (error || !insc) { setState("not-found"); return; }

    const ev = (insc as any).eventos;
    if (ev?.status !== "encerrado") { setState("evento-aberto"); return; }

    const checkins = (insc as any).checkins;
    const checkin = Array.isArray(checkins) ? checkins[0] : checkins;
    if (!checkin) { setState("no-checkin"); return; }

    setCert({
      atleta_nome: insc.atleta_nome,
      atleta_faixa: insc.atleta_faixa ?? undefined,
      atleta_sexo: insc.atleta_sexo ?? undefined,
      categoria: (insc as any).categorias?.nome ?? "",
      associacao: (insc as any).associacoes?.nome ?? "",
      evento_nome: ev?.nome ?? "",
      evento_data_inicio: ev?.data_inicio ?? "",
      evento_data_fim: ev?.data_fim ?? "",
      evento_local: ev?.local ?? "",
      evento_cidade: ev?.cidade ?? "",
      evento_uf: ev?.uf ?? "",
      modalidade: ev?.modalidade ?? "",
      logo_url: ev?.logo_url ?? undefined,
      template: (ev?.certificado_template as CertTemplate) ?? DEFAULT_TEMPLATE,
    });
    setState("ok");
  }

  if (state === "loading") {
    return <FullCenter><Spinner className="w-10 h-10 text-blue-600" /></FullCenter>;
  }
  if (state === "not-found") return (
    <Feedback Icon={XCircle} color="#ef4444" bg="#fef2f2"
      title="Certificado não encontrado"
      desc="O link pode estar incorreto ou a inscrição não existe." />
  );
  if (state === "evento-aberto") return (
    <Feedback Icon={Clock} color="#d97706" bg="#fffbeb"
      title="Evento ainda não encerrado"
      desc="Os certificados serão liberados após o encerramento oficial do evento." />
  );
  if (state === "no-checkin") return (
    <Feedback Icon={AlertTriangle} color="#d97706" bg="#fffbeb"
      title="Check-in não realizado"
      desc="O certificado é emitido apenas para atletas que participaram presencialmente." />
  );
  if (!cert) return null;

  const dataEvento = cert.evento_data_inicio === cert.evento_data_fim
    ? formatDateLong(cert.evento_data_inicio)
    : `${formatDateLong(cert.evento_data_inicio)} a ${formatDateLong(cert.evento_data_fim)}`;

  const variables: Record<string, string> = {
    "{{atleta_nome}}": cert.atleta_nome,
    "{{evento_nome}}": cert.evento_nome,
    "{{data_evento}}": dataEvento,
    "{{local}}": cert.evento_local,
    "{{cidade}}": cert.evento_cidade ? `${cert.evento_cidade}/${cert.evento_uf}` : cert.evento_uf,
    "{{categoria}}": cert.categoria,
    "{{associacao}}": cert.associacao,
    "{{faixa}}": cert.atleta_faixa ?? "",
    "{{modalidade}}": cert.modalidade,
  };

  const PX_PER_MM = 3.7795;
  const PREVIEW_SCALE = 0.38;
  const pw = cert.template.paper.width_mm * PX_PER_MM * PREVIEW_SCALE;
  const ph = cert.template.paper.height_mm * PX_PER_MM * PREVIEW_SCALE;

  return (
    <>
      {/* ── Tela de preview ──────────────────────────────────────────── */}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex flex-col items-center justify-center p-6 print:hidden gap-6">
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 max-w-sm w-full text-center text-white">
          <Trophy className="w-10 h-10 text-blue-300 mx-auto mb-3" />
          <h1 className="text-lg font-black mb-1">Certificado de Participação</h1>
          <p className="text-white/70 text-sm mb-1"><strong className="text-white">{cert.atleta_nome}</strong></p>
          <p className="text-white/50 text-xs mb-4">{cert.evento_nome}</p>
          <button onClick={() => window.print()} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all">
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF (A3)
          </button>
          <p className="text-white/30 text-xs mt-3">Papel A3 paisagem</p>
        </div>
        {/* Mini preview */}
        <div style={{ width: pw, height: ph, overflow: "hidden", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
          <CertificadoRenderer template={cert.template} variables={variables} scale={PREVIEW_SCALE} logoUrl={cert.logo_url} />
        </div>
      </div>

      {/* ── Impressão A3 ─────────────────────────────────────────────── */}
      <div className="hidden print:block">
        <style>{`
          @media print {
            @page { size: A3 landscape; margin: 0; }
            html, body { margin: 0; padding: 0; }
          }
        `}</style>
        <CertificadoRenderer template={cert.template} variables={variables} scale={1} logoUrl={cert.logo_url} />
      </div>
    </>
  );
}

function CertificadoA3({ cert, dataEvento }: { cert: CertData; dataEvento: string }) {
  const FAIXA_COR: Record<string, string> = {
    Branca: "#f8fafc", Cinza: "#94a3b8", Azul: "#3b82f6", Amarela: "#fbbf24",
    Laranja: "#f97316", Verde: "#22c55e", Roxa: "#a855f7", Marrom: "#92400e", Preta: "#1e293b",
  };
  const corFaixa = cert.atleta_faixa ? FAIXA_COR[cert.atleta_faixa] ?? "#374151" : null;

  return (
    <div style={{
      width: "420mm", height: "297mm", position: "relative", overflow: "hidden",
      background: "white", fontFamily: "'Georgia', 'Times New Roman', serif",
      display: "flex",
    }}>

      {/* ── Faixa lateral esquerda (azul profundo) ── */}
      <div style={{
        width: "52mm", background: "linear-gradient(180deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "space-between", padding: "12mm 6mm",
        position: "relative", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4mm" }}>
          {cert.logo_url ? (
            <img src={cert.logo_url} alt="Logo" style={{ width: "30mm", height: "30mm", objectFit: "contain", borderRadius: "4mm", background: "white", padding: "2mm" }} />
          ) : (
            <div style={{ width: "30mm", height: "30mm", background: "rgba(255,255,255,0.15)", borderRadius: "4mm", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "20mm", lineHeight: 1 }}>🏆</span>
            </div>
          )}
          <div style={{ color: "white", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "12pt", letterSpacing: "-0.5px" }}>Arena</div>
            <div style={{ fontSize: "6pt", color: "rgba(255,255,255,0.6)", marginTop: "1mm", fontFamily: "Arial, sans-serif", letterSpacing: "0.5px" }}>EVENTOS ESPORTIVOS</div>
          </div>
        </div>

        {/* Faixa do atleta (vertical) */}
        {cert.atleta_faixa && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2mm" }}>
            <div style={{ width: "8mm", height: "28mm", background: corFaixa!, borderRadius: "2mm", border: "1px solid rgba(255,255,255,0.3)" }} />
            <div style={{ fontSize: "6pt", color: "rgba(255,255,255,0.7)", fontFamily: "Arial, sans-serif", textAlign: "center", transform: "none" }}>
              Faixa<br />{cert.atleta_faixa}
            </div>
          </div>
        )}

        {/* Data de geração */}
        <div style={{ fontSize: "5.5pt", color: "rgba(255,255,255,0.4)", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
          Emitido em<br />{new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>

      {/* ── Corpo principal ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12mm 14mm 10mm" }}>

        {/* Topo: título + ornamento */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "6mm" }}>
          <div>
            <div style={{ fontSize: "8pt", color: "#64748b", fontFamily: "Arial, sans-serif", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "2mm" }}>
              Certificado de Participação
            </div>
            <div style={{ width: "80mm", height: "3px", background: "linear-gradient(90deg, #1d4ed8, #7c3aed, transparent)" }} />
          </div>
          {/* Ornamento canto */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "7pt", color: "#94a3b8", fontFamily: "Arial, sans-serif" }}>{cert.modalidade}</div>
          </div>
        </div>

        {/* Texto central */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: "11pt", color: "#475569", fontFamily: "Arial, sans-serif", margin: "0 0 3mm", fontStyle: "italic" }}>
            Certificamos que
          </p>

          {/* Nome do atleta — destaque máximo */}
          <div style={{ position: "relative", margin: "0 0 4mm" }}>
            <div style={{ position: "absolute", left: "-14mm", top: "50%", transform: "translateY(-50%)", width: "10mm", height: "0.5mm", background: "#1d4ed8" }} />
            <p style={{
              fontSize: "36pt", fontWeight: 900, color: "#0f172a",
              margin: 0, lineHeight: 1.1, letterSpacing: "-1px",
              textShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}>
              {cert.atleta_nome}
            </p>
          </div>

          {cert.associacao && (
            <p style={{ fontSize: "12pt", color: "#64748b", fontFamily: "Arial, sans-serif", margin: "0 0 5mm", fontStyle: "italic" }}>
              {cert.associacao}
            </p>
          )}

          <p style={{ fontSize: "11pt", color: "#475569", fontFamily: "Arial, sans-serif", margin: "0 0 2mm" }}>
            participou como competidor(a) do evento
          </p>

          <p style={{ fontSize: "20pt", fontWeight: 700, color: "#1d4ed8", margin: "0 0 2mm", letterSpacing: "-0.5px" }}>
            {cert.evento_nome}
          </p>

          <p style={{ fontSize: "10pt", color: "#64748b", fontFamily: "Arial, sans-serif", margin: "0 0 4mm" }}>
            {dataEvento} &bull; {cert.evento_local}{cert.evento_cidade ? `, ${cert.evento_cidade}/${cert.evento_uf}` : ""}
          </p>

          {cert.categoria && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "4mm" }}>
              <div style={{ width: "3mm", height: "3mm", borderRadius: "50%", background: "#1d4ed8" }} />
              <p style={{ fontSize: "10pt", color: "#334155", fontFamily: "Arial, sans-serif", margin: 0 }}>
                Categoria: <strong>{cert.categoria}</strong>
                {cert.atleta_faixa ? <span style={{ color: "#64748b" }}> &bull; Faixa {cert.atleta_faixa}</span> : null}
                {" "}&bull; {cert.atleta_sexo === "M" ? "Masculino" : "Feminino"}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé com assinaturas */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "6mm", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Assinatura label="Diretor Técnico" />
          <div style={{ textAlign: "center" }}>
            {/* Medalha decorativa central */}
            <div style={{
              width: "18mm", height: "18mm", borderRadius: "50%", margin: "0 auto 2mm",
              background: "linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(251,191,36,0.5)",
              border: "2px solid #d97706",
            }}>
              <span style={{ fontSize: "10mm", lineHeight: 1 }}>🥇</span>
            </div>
            <div style={{ fontSize: "6pt", color: "#94a3b8", fontFamily: "Arial, sans-serif", fontStyle: "italic" }}>
              Documento autêntico · Arena Eventos Esportivos
            </div>
          </div>
          <Assinatura label="Organizador do Evento" />
        </div>
      </div>

      {/* ── Faixa lateral direita (decorativa) ── */}
      <div style={{
        width: "8mm", flexShrink: 0,
        background: "linear-gradient(180deg, #1d4ed8 0%, #7c3aed 50%, #db2777 100%)",
      }} />
    </div>
  );
}

function Assinatura({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: "50mm" }}>
      <div style={{ width: "45mm", height: "0.5mm", background: "#0f172a", margin: "0 auto 2mm" }} />
      <div style={{ fontSize: "7pt", color: "#64748b", fontFamily: "Arial, sans-serif" }}>{label}</div>
    </div>
  );
}

function FullCenter({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-950">{children}</div>;
}

function Feedback({ Icon, color, bg, title, desc }: { Icon: React.ElementType; color: string; bg: string; title: string; desc: string }) {
  return (
    <FullCenter>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-sm w-full text-center mx-4">
        <div style={{ width: 64, height: 64, borderRadius: 16, background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon style={{ width: 32, height: 32, color }} />
        </div>
        <h1 className="text-lg font-black text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 text-sm">{desc}</p>
      </div>
    </FullCenter>
  );
}
