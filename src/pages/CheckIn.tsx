import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { Trophy, Camera, CheckCircle, XCircle, AlertTriangle, RotateCcw, User } from "lucide-react";
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

  useEffect(() => {
    startCamera();
    loadTotalHoje();
    return () => { stopCamera(); };
  }, []);

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
      // Busca inscrição pelo token
      const { data: insc, error } = await supabase
        .from("inscricoes")
        .select("id, atleta_nome, atleta_data_nascimento, atleta_sexo, atleta_faixa, status, evento_id, categorias(nome), associacoes(nome)")
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

      // Verifica se já fez check-in
      const { data: existing } = await supabase
        .from("checkins")
        .select("id, realizado_em")
        .eq("inscricao_id", insc.id)
        .single();

      if (existing) {
        setAtleta({
          nome: insc.atleta_nome,
          categoria: (insc.categorias as any)?.nome ?? "",
          associacao: (insc.associacoes as any)?.nome ?? "",
          faixa: insc.atleta_faixa ?? "",
          sexo: insc.atleta_sexo,
          idade: calcularIdade(insc.atleta_data_nascimento),
          inscricaoId: insc.id,
        });
        setState("already");
        return;
      }

      // Registra check-in
      await supabase.from("checkins").insert({
        inscricao_id: insc.id,
        evento_id: insc.evento_id,
        realizado_em: new Date().toISOString(),
      });

      setAtleta({
        nome: insc.atleta_nome,
        categoria: (insc.categorias as any)?.nome ?? "",
        associacao: (insc.associacoes as any)?.nome ?? "",
        faixa: insc.atleta_faixa ?? "",
        sexo: insc.atleta_sexo,
        idade: calcularIdade(insc.atleta_data_nascimento),
        inscricaoId: insc.id,
      });

      setTotalHoje((n) => n + 1);
      setState("success");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setState("error");
    }
  }

  function resetScan() {
    processingRef.current = false;
    setAtleta(null);
    setErrorMsg("");
    setState("scanning");
    animRef.current = requestAnimationFrame(scanLoop);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-white/30 mx-2">·</span>
          <span className="text-white/60 text-sm">Check-in</span>
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-sm font-bold">{totalHoje} hoje</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Câmera */}
        <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border-2 border-white/20">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Guia de scan */}
          {state === "scanning" && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                  {/* Linha de scan animada */}
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400/80 animate-[scan_2s_ease-in-out_infinite]" style={{ animation: "scan 2s ease-in-out infinite" }} />
                </div>
              </div>
              <div className="absolute bottom-4 inset-x-0 text-center">
                <p className="text-white/60 text-sm">Aponte para o QR Code da credencial</p>
              </div>
            </>
          )}

          {/* Loading overlay */}
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <Spinner className="w-10 h-10 text-blue-400" />
            </div>
          )}

          {/* Sem câmera */}
          {state === "nocamera" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6">
              <Camera className="w-10 h-10 text-white/40" />
              <p className="text-center text-white/60 text-sm">Câmera não disponível ou permissão negada</p>
            </div>
          )}
        </div>

        {/* Resultado */}
        {state === "success" && atleta && (
          <ResultCard
            type="success"
            atleta={atleta}
            onReset={resetScan}
            message="Check-in realizado!"
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

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: calc(100% - 2px); }
        }
      `}</style>
    </div>
  );
}

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
