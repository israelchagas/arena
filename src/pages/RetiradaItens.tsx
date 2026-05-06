import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, CheckCircle, XCircle, RotateCcw,
  Package, Scan, AlertTriangle,
} from "lucide-react";
import { calcularIdade } from "@/lib/utils";

type PageState = "scanning" | "loading" | "athlete_found" | "confirming_item" | "error";

interface ItemTipo {
  id: string;
  nome: string;
  ordem: number;
}

interface Retirada {
  id: string;
  item_tipo_id: string;
}

interface AtletaInfo {
  inscricaoId: string;
  nome: string;
  categoria: string;
  associacao: string;
  faixa: string;
  idade: number;
  eventoId: string;
  token: string;
}

export default function RetiradaItens() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const processingRef = useRef(false);

  const [state, setState] = useState<PageState>("scanning");
  const [atleta, setAtleta] = useState<AtletaInfo | null>(null);
  const [itens, setItens] = useState<ItemTipo[]>([]);
  const [retiradas, setRetiradas] = useState<Retirada[]>([]);
  const [confirmingItem, setConfirmingItem] = useState<ItemTipo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [flashMsg, setFlashMsg] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

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
      setErrorMsg("Câmera não disponível ou permissão negada.");
      setState("error");
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
      handleScan(code.data);
    } else {
      animRef.current = requestAnimationFrame(scanLoop);
    }
  }

  async function handleScan(token: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    cancelAnimationFrame(animRef.current);
    setState("loading");

    if (confirmingItem && atleta) {
      if (token !== atleta.token) {
        setFlashMsg("QR diferente do atleta identificado.");
        setState("confirming_item");
        processingRef.current = false;
        animRef.current = requestAnimationFrame(scanLoop);
        return;
      }
      await registrarRetirada(confirmingItem);
      return;
    }

    await identificarAtleta(token);
  }

  async function identificarAtleta(token: string) {
    try {
      const { data: insc, error } = await supabase
        .from("inscricoes")
        .select("id, atleta_nome, atleta_data_nascimento, atleta_faixa, status, evento_id, categorias(nome), associacoes(nome)")
        .eq("check_in_token", token)
        .single();

      if (error || !insc) {
        setErrorMsg("QR Code inválido ou não encontrado.");
        setState("error");
        return;
      }

      if (insc.status !== "confirmado") {
        setErrorMsg(`Inscrição com status "${insc.status}". Retirada não permitida.`);
        setState("error");
        return;
      }

      const [itensRes, retiradasRes] = await Promise.all([
        supabase
          .from("item_tipos")
          .select("id, nome, ordem")
          .eq("evento_id", insc.evento_id)
          .eq("ativo", true)
          .order("ordem"),
        supabase
          .from("retiradas")
          .select("id, item_tipo_id")
          .eq("inscricao_id", insc.id),
      ]);

      setAtleta({
        inscricaoId: insc.id,
        nome: insc.atleta_nome,
        categoria: (insc.categorias as any)?.nome ?? "",
        associacao: (insc.associacoes as any)?.nome ?? "",
        faixa: insc.atleta_faixa ?? "",
        idade: calcularIdade(insc.atleta_data_nascimento),
        eventoId: insc.evento_id,
        token,
      });
      setItens(itensRes.data ?? []);
      setRetiradas(retiradasRes.data ?? []);
      setState("athlete_found");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setState("error");
    }
  }

  async function registrarRetirada(item: ItemTipo) {
    try {
      const { error } = await supabase.from("retiradas").insert({
        inscricao_id: atleta!.inscricaoId,
        item_tipo_id: item.id,
        evento_id: atleta!.eventoId,
      });

      if (error && error.code === "23505") {
        // Duplicate — already registered, just update UI
      } else if (error) {
        throw error;
      }

      setRetiradas((prev) => [...prev.filter((r) => r.item_tipo_id !== item.id), { id: crypto.randomUUID(), item_tipo_id: item.id }]);
      setConfirmingItem(null);
      setFlashMsg(`"${item.nome}" entregue!`);
      setTimeout(() => setFlashMsg(""), 3000);
      setState("athlete_found");
      processingRef.current = false;
    } catch (e: any) {
      setErrorMsg(`Erro ao registrar: ${e?.message}`);
      setState("error");
    }
  }

  function iniciarConfirmacao(item: ItemTipo) {
    setConfirmingItem(item);
    setFlashMsg("");
    setState("confirming_item");
    processingRef.current = false;
    animRef.current = requestAnimationFrame(scanLoop);
  }

  function cancelarConfirmacao() {
    setConfirmingItem(null);
    setState("athlete_found");
    processingRef.current = false;
  }

  function resetScan() {
    processingRef.current = false;
    setAtleta(null);
    setItens([]);
    setRetiradas([]);
    setConfirmingItem(null);
    setErrorMsg("");
    setFlashMsg("");
    setState("scanning");
    animRef.current = requestAnimationFrame(scanLoop);
  }

  const itensPendentes = itens.filter((i) => !retiradas.some((r) => r.item_tipo_id === i.id));
  const itensEntregues = itens.filter((i) => retiradas.some((r) => r.item_tipo_id === i.id));
  const tudoEntregue = itens.length > 0 && itensPendentes.length === 0;

  const cameraVisible = state === "scanning" || state === "confirming_item" || state === "loading";

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-white/30 mx-2">·</span>
          <span className="text-white/60 text-sm">Retirada de Itens</span>
        </div>
        {state === "athlete_found" && atleta && (
          <button onClick={resetScan} className="text-white/50 hover:text-white text-xs transition-colors">
            Trocar atleta
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Câmera */}
        {cameraVisible && (
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border-2 border-white/20">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />

            {state !== "loading" && (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                    <div className="absolute inset-x-0 h-0.5 bg-blue-400/80" style={{ animation: "scan 2s ease-in-out infinite" }} />
                  </div>
                </div>
                <div className="absolute bottom-4 inset-x-0 text-center px-6">
                  {state === "confirming_item" && confirmingItem ? (
                    <p className="text-amber-300 text-sm font-semibold bg-black/50 rounded-lg px-3 py-2">
                      Escaneie o QR para confirmar:<br />
                      <span className="text-white font-black">"{confirmingItem.nome}"</span>
                    </p>
                  ) : (
                    <p className="text-white/60 text-sm">Escaneie o QR Code da credencial</p>
                  )}
                </div>
              </>
            )}

            {state === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <Spinner className="w-10 h-10 text-blue-400" />
              </div>
            )}
          </div>
        )}

        {/* Cancelar confirmação */}
        {state === "confirming_item" && (
          <button onClick={cancelarConfirmacao} className="text-white/50 hover:text-white text-sm underline transition-colors">
            Cancelar
          </button>
        )}

        {/* Atleta encontrado */}
        {state === "athlete_found" && atleta && (
          <div className="w-full max-w-sm space-y-4">

            {/* Card do atleta */}
            <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Atleta identificado</p>
              <p className="font-black text-xl text-white">{atleta.nome}</p>
              <div className="flex gap-2 flex-wrap mt-2 text-xs">
                <span className="bg-white/10 px-2 py-0.5 rounded-lg text-white/70">{atleta.idade} anos</span>
                {atleta.categoria && <span className="bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-lg">{atleta.categoria}</span>}
                {atleta.faixa && <span className="bg-white/15 px-2 py-0.5 rounded-lg">Faixa {atleta.faixa}</span>}
                {atleta.associacao && <span className="text-white/40 px-2 py-0.5">{atleta.associacao}</span>}
              </div>
            </div>

            {/* Flash de sucesso */}
            {flashMsg && (
              <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3 text-green-300 text-sm font-semibold">
                <CheckCircle className="w-4 h-4 flex-shrink-0" /> {flashMsg}
              </div>
            )}

            {/* Tudo entregue */}
            {tudoEntregue && (
              <div className="bg-green-500/20 border border-green-500/40 rounded-2xl p-6 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="font-black text-green-300 text-lg">Tudo entregue!</p>
                <p className="text-green-400/70 text-sm mt-1">Todos os itens foram retirados.</p>
              </div>
            )}

            {/* Itens pendentes */}
            {itensPendentes.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
                  Pendentes ({itensPendentes.length})
                </p>
                <div className="space-y-2">
                  {itensPendentes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="font-semibold text-white">{item.nome}</span>
                      </div>
                      <button
                        onClick={() => iniciarConfirmacao(item)}
                        className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                      >
                        <Scan className="w-3.5 h-3.5" /> Entregar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Itens já entregues */}
            {itensEntregues.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">
                  Já entregues ({itensEntregues.length})
                </p>
                <div className="space-y-1.5">
                  {itensEntregues.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 opacity-70">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-white/70 text-sm">{item.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sem itens configurados */}
            {itens.length === 0 && (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-amber-400/40 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Nenhum item configurado para este evento.</p>
                <p className="text-white/30 text-xs mt-1">Configure os itens em Admin → Itens para Retirada.</p>
              </div>
            )}

            <button
              onClick={resetScan}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-sm font-bold transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Próximo atleta
            </button>
          </div>
        )}

        {/* Erro */}
        {state === "error" && (
          <div className="w-full max-w-sm bg-red-500/20 border border-red-500/40 rounded-2xl p-6 text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="font-bold text-red-300 text-lg">Erro</p>
            <p className="text-red-400/80 text-sm mt-1">{errorMsg}</p>
            <button onClick={resetScan} className="mt-4 flex items-center gap-2 mx-auto bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
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
