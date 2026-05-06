import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, Camera, CheckCircle, XCircle, AlertTriangle, RotateCcw, User, Printer, PrinterCheck } from "lucide-react";
import { calcularIdade } from "@/lib/utils";

type ScanState = "scanning" | "loading" | "success" | "already" | "error" | "nocamera";

interface AtletaInfo {
  nome: string;
  categoria: string;
  associacao: string;
  faixa: string;
  sexo: string;
  idade: number;
  inscricaoId: string;
}

interface PrintData {
  token: string;
  nome: string;
  sexo: "M" | "F";
  dataNasc: string;
  faixa?: string;
  peso?: number;
  categoria?: string;
  associacao?: string;
  inscricaoId: string;
  eventoNome: string;
}

const FAIXA_COR: Record<string, string> = {
  Branca: "#e5e7eb", Cinza: "#9ca3af", Azul: "#3b82f6", Amarela: "#fbbf24",
  Laranja: "#f97316", Verde: "#22c55e", Roxa: "#a855f7", Marrom: "#92400e", Preta: "#111827",
};

export default function CheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const processingRef = useRef(false);

  const [state, setState] = useState<ScanState>("scanning");
  const [atleta, setAtleta] = useState<AtletaInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [totalHoje, setTotalHoje] = useState(0);
  const [autoPrint, setAutoPrint] = useState(true);
  const [printData, setPrintData] = useState<PrintData | null>(null);
  const printReadyRef = useRef(false);

  useEffect(() => {
    startCamera();
    loadTotalHoje();
    return () => { stopCamera(); };
  }, []);

  // Dispara impressão quando printData é definido
  useEffect(() => {
    if (!printData || !autoPrint || printReadyRef.current) return;
    printReadyRef.current = true;
    const timer = setTimeout(async () => {
      window.print();
      await supabase
        .from("inscricoes")
        .update({ sticker_printed: true })
        .eq("id", printData.inscricaoId);
    }, 300);
    return () => clearTimeout(timer);
  }, [printData, autoPrint]);

  async function loadTotalHoje() {
    const hoje = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .gte("realizado_em", `${hoje}T00:00:00`);
    setTotalHoje(count ?? 0);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        videoRef.current.onloadedmetadata = () => scanLoop();
      }
    } catch {
      setState("nocamera");
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animRef.current);
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
  }

  function scanLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || processingRef.current) {
      animRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) { animRef.current = requestAnimationFrame(scanLoop); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (code?.data) {
      processToken(code.data);
    } else {
      animRef.current = requestAnimationFrame(scanLoop);
    }
  }

  async function processToken(token: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    cancelAnimationFrame(animRef.current);
    setState("loading");

    try {
      const { data: insc, error } = await supabase
        .from("inscricoes")
        .select("id, atleta_nome, atleta_data_nascimento, atleta_sexo, atleta_faixa, atleta_peso, status, evento_id, categorias(nome), associacoes(nome)")
        .eq("check_in_token", token)
        .single();

      if (error || !insc) {
        setErrorMsg("QR Code inválido ou não encontrado.");
        setState("error");
        return;
      }

      if (insc.status !== "confirmado") {
        setErrorMsg(`Inscrição com status "${insc.status}". Check-in não permitido.`);
        setState("error");
        return;
      }

      const { data: existing } = await supabase
        .from("checkins")
        .select("id")
        .eq("inscricao_id", insc.id)
        .single();

      const atletaInfo: AtletaInfo = {
        nome: insc.atleta_nome,
        categoria: (insc.categorias as any)?.nome ?? "",
        associacao: (insc.associacoes as any)?.nome ?? "",
        faixa: insc.atleta_faixa ?? "",
        sexo: insc.atleta_sexo,
        idade: calcularIdade(insc.atleta_data_nascimento),
        inscricaoId: insc.id,
      };

      if (existing) {
        setAtleta(atletaInfo);
        setState("already");
        return;
      }

      // Registra check-in
      await supabase.from("checkins").insert({
        inscricao_id: insc.id,
        evento_id: insc.evento_id,
        realizado_em: new Date().toISOString(),
      });

      setAtleta(atletaInfo);
      setTotalHoje((n) => n + 1);
      setState("success");

      // Prepara dados de impressão
      if (autoPrint) {
        const { data: evt } = await supabase
          .from("eventos")
          .select("nome")
          .eq("id", insc.evento_id)
          .single();

        printReadyRef.current = false;
        setPrintData({
          token,
          nome: insc.atleta_nome,
          sexo: insc.atleta_sexo,
          dataNasc: insc.atleta_data_nascimento,
          faixa: insc.atleta_faixa ?? undefined,
          peso: insc.atleta_peso ?? undefined,
          categoria: (insc.categorias as any)?.nome,
          associacao: (insc.associacoes as any)?.nome,
          inscricaoId: insc.id,
          eventoNome: evt?.nome ?? "",
        });
      }
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setState("error");
    }
  }

  function resetScan() {
    processingRef.current = false;
    printReadyRef.current = false;
    setAtleta(null);
    setPrintData(null);
    setErrorMsg("");
    setState("scanning");
    animRef.current = requestAnimationFrame(scanLoop);
  }

  return (
    <>
      {/* ── Interface de check-in ─────────────────────────────────── */}
      <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col print:hidden">
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-400" />
            <span className="font-black text-lg">Arena</span>
            <span className="text-white/30 mx-2">·</span>
            <span className="text-white/60 text-sm">Check-in</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle impressão automática */}
            <button
              onClick={() => setAutoPrint((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                autoPrint
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-white/40"
              }`}
              title={autoPrint ? "Impressão automática ativa" : "Impressão automática desativada"}
            >
              {autoPrint ? <PrinterCheck className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
              {autoPrint ? "Auto-imprimir" : "Sem impressão"}
            </button>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold">{totalHoje} hoje</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

          {/* Câmera */}
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border-2 border-white/20">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {state === "scanning" && (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/80 animate-[scan_2s_ease-in-out_infinite]" style={{ animation: "scan 2s ease-in-out infinite" }} />
                  </div>
                </div>
                <div className="absolute bottom-4 inset-x-0 text-center">
                  <p className="text-white/60 text-sm">Aponte para o QR Code da credencial</p>
                </div>
              </>
            )}

            {state === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <Spinner className="w-10 h-10 text-blue-400" />
              </div>
            )}

            {state === "nocamera" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
                <Camera className="w-10 h-10 text-white/40" />
                <p className="text-center text-white/60 text-sm">Câmera não disponível ou permissão negada</p>
              </div>
            )}
          </div>

          {state === "success" && atleta && (
            <ResultCard
              type="success"
              atleta={atleta}
              onReset={resetScan}
              message={autoPrint ? "Check-in realizado! Imprimindo..." : "Check-in realizado!"}
            />
          )}

          {state === "already" && atleta && (
            <ResultCard
              type="already"
              atleta={atleta}
              onReset={resetScan}
              message="Check-in já registrado"
            />
          )}

          {state === "error" && (
            <div className="w-full max-w-sm bg-red-500/20 border border-red-500/40 rounded-2xl p-6 text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="font-bold text-red-300 text-lg">Não encontrado</p>
              <p className="text-red-400/80 text-sm mt-1">{errorMsg}</p>
              <button onClick={resetScan} className="mt-4 flex items-center gap-2 mx-auto bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                <RotateCcw className="w-4 h-4" /> Escanear novamente
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Credencial para impressão ────────────────────────────────── */}
      {printData && (
        <div className="hidden print:block">
          <style>{`
            @media print {
              @page { size: 80mm 50mm; margin: 2mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .credential-card {
                display: flex;
                flex-direction: column;
                width: 76mm;
                height: 46mm;
                overflow: hidden;
                box-sizing: border-box;
              }
            }
          `}</style>
          <CredencialPrint data={printData} />
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: calc(100% - 2px); }
        }
      `}</style>
    </>
  );
}

// ── Credencial de impressão ──────────────────────────────────────────────────

function CredencialPrint({ data: d }: { data: PrintData }) {
  const corFaixa = FAIXA_COR[d.faixa ?? ""] ?? "#374151";
  const textoFaixa = d.faixa === "Branca" || d.faixa === "Amarela" ? "#111827" : "#fff";
  const idade = calcularIdade(d.dataNasc);

  return (
    <div
      className="credential-card"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", border: "0.5px solid #cbd5e1", borderRadius: "2mm", background: "#fff" }}
    >
      <div style={{
        background: "#0f172a", color: "#fff", padding: "1.5mm 3mm",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, borderRadius: "1.5mm 1.5mm 0 0",
      }}>
        <span style={{ fontWeight: 900, fontSize: "7.5pt", letterSpacing: "-0.2px" }}>🏆 Arena</span>
        <span style={{ fontSize: "5.5pt", color: "#93c5fd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55mm" }}>
          {d.eventoNome}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", padding: "2mm 3mm", gap: "3mm", flex: 1 }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "1mm" }}>
          <QRCodeSVG value={d.token} size={112} level="M" includeMargin={false} />
          <span style={{ fontSize: "4pt", color: "#cbd5e1", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {d.token.slice(0, 8)}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.5mm", minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 900, fontSize: "11pt", color: "#0f172a", lineHeight: 1.1, wordBreak: "break-word" }}>
            {d.nome}
          </p>
          {d.categoria && (
            <p style={{ margin: 0, fontSize: "7.5pt", color: "#1d4ed8", fontWeight: 700 }}>{d.categoria}</p>
          )}
          {d.associacao && (
            <p style={{ margin: 0, fontSize: "6.5pt", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.associacao}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5mm", alignItems: "center" }}>
            <span style={{ fontSize: "6pt", background: "#f1f5f9", color: "#475569", padding: "0.5mm 2mm", borderRadius: "999px", fontWeight: 600 }}>
              {d.sexo === "M" ? "Masc." : "Fem."} · {idade}a
            </span>
            {d.faixa && (
              <span style={{ fontSize: "6pt", fontWeight: 700, background: corFaixa, color: textoFaixa, padding: "0.5mm 2.5mm", borderRadius: "999px", whiteSpace: "nowrap" }}>
                {d.faixa}
              </span>
            )}
            {d.peso && (
              <span style={{ fontSize: "6pt", background: "#f1f5f9", color: "#475569", padding: "0.5mm 2mm", borderRadius: "999px", fontWeight: 600 }}>
                {d.peso} kg
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de resultado ────────────────────────────────────────────────────────

function ResultCard({ type, atleta, onReset, message }: {
  type: "success" | "already";
  atleta: AtletaInfo;
  onReset: () => void;
  message: string;
}) {
  const isSuccess = type === "success";
  const corFaixa = FAIXA_COR[atleta.faixa] ?? "#374151";
  const textoFaixa = atleta.faixa === "Branca" || atleta.faixa === "Amarela" ? "#111" : "#fff";

  return (
    <div className={`w-full max-w-sm rounded-2xl p-6 border ${isSuccess ? "bg-green-500/20 border-green-500/40" : "bg-amber-500/20 border-amber-500/40"}`}>
      <div className="flex items-center gap-3 mb-4">
        {isSuccess
          ? <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
          : <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />}
        <p className={`font-black text-xl ${isSuccess ? "text-green-300" : "text-amber-300"}`}>{message}</p>
      </div>

      <div className="bg-white/10 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-white/40" />
          <p className="font-bold text-white text-lg">{atleta.nome}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="bg-white/10 px-2.5 py-1 rounded-lg text-white/80">{atleta.idade} anos · {atleta.sexo === "M" ? "Masculino" : "Feminino"}</span>
          {atleta.categoria && <span className="bg-blue-500/30 text-blue-300 px-2.5 py-1 rounded-lg font-medium">{atleta.categoria}</span>}
          {atleta.faixa && (
            <span className="px-2.5 py-1 rounded-lg font-medium text-xs" style={{ background: corFaixa, color: textoFaixa }}>
              Faixa {atleta.faixa}
            </span>
          )}
          {atleta.associacao && <span className="bg-white/10 px-2.5 py-1 rounded-lg text-white/60 text-xs">{atleta.associacao}</span>}
        </div>
      </div>

      <button
        onClick={onReset}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-sm font-bold transition-all"
      >
        <RotateCcw className="w-4 h-4" /> Próximo atleta
      </button>
    </div>
  );
}
