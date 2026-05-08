import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import jsQR from "jsqr";
import { supabase } from "@/lib/supabase";
import { BluetoothPrinter, PrintInfo } from "@/lib/bluetooth-printer";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, Camera, CheckCircle, XCircle, AlertTriangle, RotateCcw,
  User, Bluetooth, BluetoothOff, BluetoothConnected, PrinterCheck, Printer,
} from "lucide-react";
import { calcularIdade } from "@/lib/utils";

type ScanState = "scanning" | "loading" | "success" | "already" | "error" | "nocamera";
type PrinterStatus = "disconnected" | "connecting" | "connected" | "error";

interface AtletaInfo {
  nome: string;
  categoria: string;
  associacao: string;
  faixa: string;
  sexo: string;
  idade: number;
  inscricaoId: string;
}

interface PrintData extends PrintInfo {
  inscricaoId: string;
}

const FAIXA_COR: Record<string, string> = {
  Branca: "#e5e7eb", Cinza: "#9ca3af", Azul: "#3b82f6", Amarela: "#fbbf24",
  Laranja: "#f97316", Verde: "#22c55e", Roxa: "#a855f7", Marrom: "#92400e", Preta: "#111827",
};

export default function CheckIn() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const processingRef = useRef(false);
  const printReadyRef = useRef(false);
  const printerRef    = useRef<BluetoothPrinter | null>(null);

  const [state, setState]             = useState<ScanState>("scanning");
  const [atleta, setAtleta]           = useState<AtletaInfo | null>(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const [totalHoje, setTotalHoje]     = useState(0);
  const [autoPrint, setAutoPrint]     = useState(true);
  const [printData, setPrintData]     = useState<PrintData | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>("disconnected");

  useEffect(() => {
    startCamera();
    loadTotalHoje();
    return () => stopCamera();
  }, []);

  // Trigger BLE print (or fallback) when printData is ready
  useEffect(() => {
    if (!printData || !autoPrint || printReadyRef.current) return;
    printReadyRef.current = true;
    const { inscricaoId, ...info } = printData;

    (async () => {
      const printer = printerRef.current;
      if (printer?.isConnected) {
        try {
          await printer.printCredencial(info);
          await supabase.from("inscricoes").update({ sticker_printed: true }).eq("id", inscricaoId);
        } catch (e) {
          toast.error("Erro ao imprimir: " + (e as Error).message);
        }
      } else {
        // Fallback: browser print (works if printer has a proper driver installed)
        window.print();
        await supabase.from("inscricoes").update({ sticker_printed: true }).eq("id", inscricaoId);
      }
    })();
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
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || processingRef.current) {
      animRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) { animRef.current = requestAnimationFrame(scanLoop); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (code?.data) processToken(code.data);
    else animRef.current = requestAnimationFrame(scanLoop);
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

      if (error || !insc) { setErrorMsg("QR Code inválido ou não encontrado."); setState("error"); return; }
      if (insc.status !== "confirmado") {
        setErrorMsg(`Inscrição com status "${insc.status}". Check-in não permitido.`);
        setState("error"); return;
      }

      const { data: existing } = await supabase
        .from("checkins").select("id").eq("inscricao_id", insc.id).single();

      const atletaInfo: AtletaInfo = {
        nome: insc.atleta_nome,
        categoria: (insc.categorias as any)?.nome ?? "",
        associacao: (insc.associacoes as any)?.nome ?? "",
        faixa: insc.atleta_faixa ?? "",
        sexo: insc.atleta_sexo,
        idade: calcularIdade(insc.atleta_data_nascimento),
        inscricaoId: insc.id,
      };

      if (existing) { setAtleta(atletaInfo); setState("already"); return; }

      await supabase.from("checkins").insert({
        inscricao_id: insc.id,
        evento_id: insc.evento_id,
        realizado_em: new Date().toISOString(),
      });

      setAtleta(atletaInfo);
      setTotalHoje((n) => n + 1);
      setState("success");

      if (autoPrint) {
        const { data: evt } = await supabase.from("eventos").select("nome").eq("id", insc.evento_id).single();
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

  async function connectPrinter() {
    if (!BluetoothPrinter.isSupported()) {
      toast.error("Bluetooth não disponível. Use Chrome no Android ou Windows/Mac Desktop.");
      return;
    }
    // Disconnect any existing connection first
    printerRef.current?.disconnect();
    const printer = new BluetoothPrinter();
    printerRef.current = printer;
    setPrinterStatus("connecting");
    try {
      await printer.connect(() => {
        setPrinterStatus("disconnected");
        toast.error("Impressora desconectada.");
      });
      setPrinterStatus("connected");
      toast.success("Impressora AL-3179 conectada!");
    } catch (e) {
      printerRef.current = null;
      setPrinterStatus("error");
      toast.error((e as Error).message);
    }
  }

  function disconnectPrinter() {
    printerRef.current?.disconnect();
    printerRef.current = null;
    setPrinterStatus("disconnected");
  }

  // Manually re-print last credential
  async function rePrint() {
    if (!printData) return;
    const { inscricaoId, ...info } = printData;
    const printer = printerRef.current;
    if (printer?.isConnected) {
      try { await printer.printCredencial(info); }
      catch (e) { toast.error("Erro ao reimprimir: " + (e as Error).message); }
    } else {
      window.print();
    }
  }

  // ── Printer button (cycles states) ─────────────────────────────────────────
  const printerBtn = {
    disconnected: { icon: Bluetooth,          label: "Conectar Impressora",  cls: "bg-white/5 border-white/10 text-white/40",                onClick: connectPrinter     },
    connecting:   { icon: Spinner,             label: "Conectando...",        cls: "bg-blue-500/20 border-blue-400/40 text-blue-300 opacity-60", onClick: () => {}            },
    connected:    { icon: BluetoothConnected,  label: "Impressora Conectada", cls: "bg-green-500/20 border-green-400/40 text-green-300",          onClick: disconnectPrinter  },
    error:        { icon: BluetoothOff,        label: "Erro — Tentar de novo",cls: "bg-red-500/20 border-red-400/40 text-red-400",               onClick: connectPrinter     },
  }[printerStatus];

  return (
    <>
      {/* ── Interface principal ───────────────────────────── */}
      <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col print:hidden">
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-400" />
            <span className="font-black text-lg">Arena</span>
            <span className="text-white/30 mx-2">·</span>
            <span className="text-white/60 text-sm">Check-in</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">

            {/* BLE printer button */}
            <button
              onClick={printerBtn.onClick}
              disabled={printerStatus === "connecting"}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${printerBtn.cls}`}
              title={printerBtn.label}
            >
              {printerStatus === "connecting"
                ? <Spinner className="w-3.5 h-3.5" />
                : <printerBtn.icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{printerBtn.label}</span>
            </button>

            {/* Auto-print toggle */}
            <button
              onClick={() => setAutoPrint((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                autoPrint ? "bg-blue-500/20 border-blue-400/40 text-blue-300" : "bg-white/5 border-white/10 text-white/40"
              }`}
              title={autoPrint ? "Auto-impressão ativa" : "Auto-impressão desativada"}
            >
              {autoPrint ? <PrinterCheck className="w-3.5 h-3.5" /> : <Printer className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{autoPrint ? "Auto-imprimir" : "Sem impressão"}</span>
            </button>

            {/* Counter */}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold">{totalHoje} hoje</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

          {/* Camera viewport */}
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
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/80" style={{ animation: "scan 2s ease-in-out infinite" }} />
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
              onRePrint={autoPrint ? rePrint : undefined}
              message={
                autoPrint
                  ? printerStatus === "connected" ? "Check-in realizado! Imprimindo via BLE..." : "Check-in realizado! Imprimindo..."
                  : "Check-in realizado!"
              }
            />
          )}

          {state === "already" && atleta && (
            <ResultCard
              type="already"
              atleta={atleta}
              onReset={resetScan}
              onRePrint={undefined}
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

          {/* BLE connection help */}
          {printerStatus === "disconnected" && (
            <p className="text-white/30 text-xs text-center max-w-xs">
              Ligue a impressora AL-3179, clique em <strong className="text-white/50">Conectar Impressora</strong> e selecione-a na lista do navegador.
            </p>
          )}
        </div>
      </div>

      {/* ── Fallback CSS print (used only when BLE not connected) ─────────── */}
      {printData && (
        <div className="hidden print:block">
          <style>{`
            @media print {
              @page { size: 58mm auto; margin: 1mm 2mm; }
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          `}</style>
          <FallbackPrint data={printData} />
        </div>
      )}

      <style>{`
        @keyframes scan { 0%, 100% { top: 0 } 50% { top: calc(100% - 2px) } }
      `}</style>
    </>
  );
}

// ── Fallback browser-print layout (58mm CSS) ─────────────────────────────────
// Used only when the printer is NOT connected via BLE.
// Requires the printer to be installed as a system printer with a proper driver.

import { QRCodeSVG } from "qrcode.react";

function FallbackPrint({ data: d }: { data: PrintData }) {
  const idade = calcularIdade(d.dataNasc);
  const corFaixa = FAIXA_COR[d.faixa ?? ""] ?? "#374151";
  const textoFaixa = d.faixa === "Branca" || d.faixa === "Amarela" ? "#111827" : "#fff";

  return (
    <div style={{
      fontFamily: "Arial, Helvetica, sans-serif",
      width: "54mm",
      padding: "1mm",
      boxSizing: "border-box",
      fontSize: "7pt",
      color: "#111",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "0.5px solid #ccc", paddingBottom: "1mm", marginBottom: "1.5mm" }}>
        <div style={{ fontWeight: 900, fontSize: "9pt" }}>ARENA</div>
        <div style={{ fontSize: "6pt", color: "#555", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{d.eventoNome}</div>
      </div>

      {/* Name */}
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: "10pt", marginBottom: "1mm", wordBreak: "break-word" }}>{d.nome}</div>

      {/* Details */}
      {d.categoria && <div style={{ textAlign: "center", color: "#1d4ed8", fontWeight: 700, fontSize: "7pt" }}>{d.categoria}</div>}
      {d.associacao && <div style={{ textAlign: "center", color: "#555", fontSize: "6pt", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{d.associacao}</div>}
      <div style={{ textAlign: "center", fontSize: "6pt", margin: "1mm 0", display: "flex", justifyContent: "center", gap: "2mm", flexWrap: "wrap" }}>
        <span>{d.sexo === "M" ? "Masc" : "Fem"} · {idade} anos</span>
        {d.peso && <span>{d.peso} kg</span>}
        {d.faixa && (
          <span style={{ background: corFaixa, color: textoFaixa, padding: "0 1.5mm", borderRadius: "999px" }}>
            {d.faixa}
          </span>
        )}
      </div>

      {/* QR */}
      <div style={{ textAlign: "center", margin: "1.5mm 0 1mm" }}>
        <QRCodeSVG value={d.token} size={130} level="M" includeMargin={false} />
      </div>
      <div style={{ textAlign: "center", fontSize: "5pt", color: "#aaa", fontFamily: "monospace" }}>
        {d.token.slice(0, 8).toUpperCase()}
      </div>
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({ type, atleta, onReset, onRePrint, message }: {
  type: "success" | "already";
  atleta: AtletaInfo;
  onReset: () => void;
  onRePrint?: () => void;
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

      <div className="mt-4 flex gap-2">
        {onRePrint && (
          <button
            onClick={onRePrint}
            className="flex items-center justify-center gap-2 flex-1 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            title="Reimprimir credencial"
          >
            <PrinterCheck className="w-4 h-4" /> Reimprimir
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 flex-1 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-sm font-bold transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Próximo atleta
        </button>
      </div>
    </div>
  );
}
