import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, Clock, CalendarDays, MapPin, ArrowRight } from "lucide-react";

const META = 250;
const EVENTO_DATE = new Date("2026-06-13T11:00:00Z"); // 08h BRT (UTC-3)

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function calcCountdown() {
  const diff = EVENTO_DATE.getTime() - Date.now();
  if (diff <= 0) return { dias: 0, horas: 0, minutos: 0, segundos: 0, ended: true };
  const dias      = Math.floor(diff / 86_400_000);
  const horas     = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutos   = Math.floor((diff % 3_600_000)  / 60_000);
  const segundos  = Math.floor((diff % 60_000)      / 1_000);
  return { dias, horas, minutos, segundos, ended: false };
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-5 py-4 min-w-[72px] text-center shadow-lg">
        <span className="text-4xl font-black text-white tabular-nums leading-none">
          {pad(value)}
        </span>
      </div>
      <span className="text-blue-200 text-xs font-semibold mt-2 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

export default function FestivalDashboard() {
  const [count, setCount]         = useState<number | null>(null);
  const [countdown, setCountdown] = useState(calcCountdown());

  useEffect(() => {
    supabase
      .from("inscricoes")
      .select("id", { count: "exact", head: true })
      .not("numero_inscricao", "is", null)
      .then(({ count: c }) => setCount(c ?? 0));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCountdown(calcCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  const inscricoes  = count ?? 0;
  const pct         = Math.min(100, Math.round((inscricoes / META) * 100));
  const restantes   = Math.max(0, META - inscricoes);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d47a1] via-[#1565C0] to-[#1976d2] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="bg-white/15 rounded-xl p-2">
            <Trophy className="w-6 h-6 text-yellow-300" />
          </div>
          <div>
            <p className="text-white font-black text-base leading-none">Festival de Judô</p>
            <p className="text-blue-200 text-xs">Cultura de Campeões · Fomento 986080/2025</p>
          </div>
        </div>
        <a
          href="/cadastro"
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg"
        >
          Inscreva-se <ArrowRight className="w-4 h-4" />
        </a>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-10 max-w-4xl mx-auto w-full">

        {/* Título */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Festival de Judô<br />
            <span className="text-yellow-300">Cultura de Campeões</span>
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-blue-200 text-sm">
              <CalendarDays className="w-4 h-4" /> 13 de junho de 2026
            </span>
            <span className="flex items-center gap-1.5 text-blue-200 text-sm">
              <Clock className="w-4 h-4" /> 8h às 18h
            </span>
            <span className="flex items-center gap-1.5 text-blue-200 text-sm">
              <MapPin className="w-4 h-4" /> IFB Campus Estrutural, Brasília/DF
            </span>
          </div>
        </div>

        {/* Contagem regressiva */}
        {!countdown.ended ? (
          <div className="text-center space-y-4">
            <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest">
              Faltam para o evento
            </p>
            <div className="flex items-start gap-3 sm:gap-5 justify-center">
              <CountdownBox value={countdown.dias}     label="Dias" />
              <span className="text-white/60 text-3xl font-bold mt-4">:</span>
              <CountdownBox value={countdown.horas}    label="Horas" />
              <span className="text-white/60 text-3xl font-bold mt-4">:</span>
              <CountdownBox value={countdown.minutos}  label="Min" />
              <span className="text-white/60 text-3xl font-bold mt-4">:</span>
              <CountdownBox value={countdown.segundos} label="Seg" />
            </div>
          </div>
        ) : (
          <div className="bg-yellow-400/20 border border-yellow-300/40 rounded-2xl px-8 py-5 text-center">
            <p className="text-yellow-300 font-black text-xl">🏅 O evento está acontecendo agora!</p>
          </div>
        )}

        {/* Inscrições */}
        <div className="w-full max-w-lg bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl p-2.5">
              <Users className="w-5 h-5 text-white" />
            </div>
            <p className="text-white font-bold text-base">Inscrições Recebidas</p>
          </div>

          {/* Números */}
          <div className="flex items-end justify-between">
            <div>
              <span className="text-5xl font-black text-white tabular-nums">
                {count === null ? "—" : inscricoes}
              </span>
              <span className="text-blue-300 text-lg font-semibold ml-2">/ {META}</span>
            </div>
            <div className="text-right">
              <p className="text-yellow-300 font-black text-2xl">{pct}%</p>
              <p className="text-blue-200 text-xs">da meta</p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: pct >= 100
                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                  : "linear-gradient(90deg, #facc15, #f59e0b)",
              }}
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between text-xs">
            <span className="text-blue-200">
              {count === null ? "Carregando..." : `${inscricoes} inscrições confirmadas`}
            </span>
            <span className="text-blue-200">
              {restantes > 0 ? `${restantes} vagas restantes` : "Meta atingida! 🎉"}
            </span>
          </div>

          {/* Milestones */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[25, 50, 75, 100].map((m) => (
              <div
                key={m}
                className={`rounded-xl py-2 text-center text-xs font-bold transition-colors ${
                  pct >= m
                    ? "bg-yellow-400/30 text-yellow-200 border border-yellow-400/40"
                    : "bg-white/5 text-blue-400 border border-white/10"
                }`}
              >
                {m}%
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <a
          href="/cadastro"
          className="flex items-center gap-3 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black text-lg px-8 py-4 rounded-2xl transition-colors shadow-xl"
        >
          <Trophy className="w-5 h-5" />
          Garantir minha vaga
          <ArrowRight className="w-5 h-5" />
        </a>

      </main>

      {/* Footer */}
      <footer className="text-center pb-6 px-4">
        <p className="text-blue-300 text-xs">
          MRN Educacional · SCLRN 705, bloco E, loja 8, Asa Norte, Brasília – DF<br />
          CNPJ: 34.436.143/0001-62 · Evento gratuito · Entrada franca
        </p>
      </footer>
    </div>
  );
}
