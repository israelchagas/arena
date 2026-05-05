import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase, Evento, Associacao } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import {
  Trophy, User, Mail, Phone, Award, CheckCircle,
  AlertCircle, Building2, Calendar, MapPin, ChevronRight,
  ClipboardList, Shield,
} from "lucide-react";

// ── CPF ──────────────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(3, "Nome completo obrigatório"),
  cpf: z
    .string()
    .min(1, "CPF obrigatório")
    .refine((v) => v.replace(/\D/g, "").length === 11, "CPF inválido (11 dígitos)"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().optional(),
  graduacao: z.string().optional(),
  evento_id: z.string().min(1, "Selecione o evento"),
  associacao_nome: z.string().min(2, "Informe o nome da sua associação ou academia"),
});

type FormData = z.infer<typeof schema>;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CadastroProfessor() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [associacoes, setAssociacoes] = useState<Associacao[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<Evento | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const eventoId = watch("evento_id");

  useEffect(() => {
    supabase
      .from("eventos")
      .select("*")
      .eq("status", "aberto")
      .order("data_inicio")
      .then(({ data }) => {
        setEventos(data ?? []);
        setLoadingEventos(false);
      });
  }, []);

  useEffect(() => {
    if (!eventoId) { setAssociacoes([]); setEventoSelecionado(null); return; }
    setEventoSelecionado(eventos.find((e) => e.id === eventoId) ?? null);
    supabase
      .from("associacoes")
      .select("*")
      .eq("evento_id", eventoId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setAssociacoes(data ?? []));
  }, [eventoId, eventos]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    const { error } = await supabase.from("professores").insert({
      nome: data.nome.trim(),
      cpf: data.cpf.replace(/\D/g, ""),
      email: data.email.trim().toLowerCase(),
      telefone: data.telefone || null,
      graduacao: data.graduacao || null,
      evento_id: data.evento_id,
      associacao_nome: data.associacao_nome.trim(),
      status: "pendente",
    });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Este e-mail já está cadastrado para este evento.");
      } else {
        toast.error(`Erro ao enviar cadastro: ${error.message}`);
        console.error(error);
      }
      return;
    }

    setSucesso(true);
  }

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-white">
              <Trophy className="w-7 h-7 text-blue-400" />
              <span className="font-black text-2xl tracking-tight">Arena</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Cadastro enviado!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Seu cadastro foi recebido e está aguardando aprovação do organizador.
              Assim que for aprovado, você receberá um <strong>e-mail com suas credenciais de acesso</strong>.
            </p>

            {eventoSelecionado && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left mb-6">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wide mb-2">Evento selecionado</p>
                <p className="font-bold text-blue-900 text-sm">{eventoSelecionado.nome}</p>
                <div className="flex items-center gap-3 mt-1.5 text-blue-600 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(eventoSelecionado.data_inicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {eventoSelecionado.local}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 text-left text-sm text-gray-500 bg-gray-50 rounded-2xl p-4">
              {[
                "Guarde o e-mail utilizado no cadastro",
                "Verifique a caixa de spam caso não receba",
                "Em caso de dúvidas, contate o organizador",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulário ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">

      {/* Hero header */}
      <div className="px-4 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 border border-blue-400/30 rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-blue-400" />
          </div>
          <span className="font-black text-white text-2xl tracking-tight">Arena</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
          Cadastro de Professor
        </h1>
        <p className="text-blue-200 text-base max-w-md mx-auto leading-relaxed">
          Preencha o formulário abaixo para solicitar acesso ao sistema.
          Você receberá suas credenciais por e-mail após a aprovação.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 mb-8 px-4">
        {[
          { icon: User, label: "Dados" },
          { icon: ClipboardList, label: "Vínculo" },
          { icon: CheckCircle, label: "Confirmação" },
        ].map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
              <Icon className="w-3.5 h-3.5 text-blue-300" />
              <span className="text-xs text-blue-200 font-semibold">{label}</span>
            </div>
            {i < 2 && <div className="w-4 h-px bg-white/20" />}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="max-w-xl mx-auto px-4 pb-16">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {loadingEventos ? (
            <div className="flex justify-center items-center py-20">
              <Spinner className="w-8 h-8 text-blue-600" />
            </div>
          ) : eventos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Nenhum evento aberto</h3>
              <p className="text-gray-400 text-sm">
                Não há eventos com inscrições abertas no momento. Tente novamente mais tarde.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>

              {/* ── Seção 1: Dados pessoais ─────────────────────────── */}
              <div className="p-6 border-b border-gray-100">
                <SectionHeader icon={User} title="Dados pessoais" color="blue" />

                <div className="space-y-4">
                  <Field label="Nome completo" required error={errors.nome?.message}>
                    <input
                      {...register("nome")}
                      placeholder="Ex: Carlos Eduardo Silva"
                      autoComplete="name"
                      className={inp()}
                    />
                  </Field>

                  <Field label="CPF" required error={errors.cpf?.message}>
                    <input
                      {...register("cpf")}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      maxLength={14}
                      onChange={(e) =>
                        setValue("cpf", formatCPF(e.target.value), { shouldValidate: true })
                      }
                      className={inp()}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Telefone / WhatsApp" error={errors.telefone?.message}>
                      <input
                        {...register("telefone")}
                        placeholder="(61) 9 0000-0000"
                        type="tel"
                        className={inp()}
                      />
                    </Field>
                    <Field label="Graduação" error={errors.graduacao?.message}>
                      <input
                        {...register("graduacao")}
                        placeholder="Ex: Faixa Preta"
                        className={inp()}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* ── Seção 2: Acesso ─────────────────────────────────── */}
              <div className="p-6 border-b border-gray-100">
                <SectionHeader icon={Mail} title="E-mail de acesso" color="indigo" />

                <Field
                  label="E-mail"
                  required
                  error={errors.email?.message}
                  hint="Será o seu usuário de login. Suas credenciais serão enviadas para este endereço."
                >
                  <input
                    type="email"
                    {...register("email")}
                    placeholder="professor@email.com"
                    autoComplete="email"
                    className={inp()}
                  />
                </Field>
              </div>

              {/* ── Seção 3: Vínculo ────────────────────────────────── */}
              <div className="p-6 border-b border-gray-100">
                <SectionHeader icon={Building2} title="Vínculo com o evento" color="teal" />

                <div className="space-y-4">
                  <Field label="Evento" required error={errors.evento_id?.message}>
                    <select {...register("evento_id")} className={inp()}>
                      <option value="">Selecione o evento</option>
                      {eventos.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                          {e.cidade ? ` · ${e.cidade}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {eventoSelecionado && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 flex items-center gap-3">
                      <Calendar className="w-4 h-4 flex-shrink-0 text-blue-400" />
                      <div>
                        <span className="font-semibold">{eventoSelecionado.nome}</span>
                        <span className="text-blue-500 ml-2">
                          {new Date(eventoSelecionado.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                          {" · "}
                          {eventoSelecionado.local}
                        </span>
                      </div>
                    </div>
                  )}

                  <Field
                    label="Associação / Academia"
                    required
                    error={errors.associacao_nome?.message}
                    hint={!eventoId ? "Selecione um evento primeiro" : undefined}
                  >
                    <input
                      {...register("associacao_nome")}
                      disabled={!eventoId}
                      placeholder="Ex: Academia Bushido, Clube Atlético..."
                      list="assoc-datalist"
                      autoComplete="off"
                      className={inp()}
                    />
                    {associacoes.length > 0 && (
                      <datalist id="assoc-datalist">
                        {associacoes.map((a) => (
                          <option key={a.id} value={a.nome} />
                        ))}
                      </datalist>
                    )}
                  </Field>

                  {eventoId && associacoes.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                      <div className="flex items-start gap-2">
                        <Building2 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-800 mb-1.5">
                            Associações já cadastradas neste evento
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {associacoes.map((a) => (
                              <span
                                key={a.id}
                                className="text-xs bg-amber-100 text-amber-900 font-semibold px-2.5 py-0.5 rounded-full"
                              >
                                {a.nome}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-amber-600 mt-2 leading-relaxed">
                            Se sua associação já está na lista, escreva o nome exato ou selecione ao digitar.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Aviso + Botão ────────────────────────────────────── */}
              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-0.5">Aprovação necessária</p>
                    <p className="text-xs leading-relaxed text-amber-700">
                      Após o envio, o organizador irá analisar seu cadastro. Você receberá um
                      e-mail com suas credenciais assim que for aprovado.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-base transition-all shadow-md"
                >
                  {submitting ? (
                    <><Spinner className="w-5 h-5" /> Enviando cadastro...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Enviar cadastro</>
                  )}
                </button>

                <p className="text-center text-xs text-gray-400">
                  Já possui acesso?{" "}
                  <a href="/login" className="text-blue-600 font-semibold hover:underline">
                    Fazer login
                  </a>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600",
  indigo: "bg-indigo-50 text-indigo-600",
  teal:   "bg-teal-50 text-teal-600",
};

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${COLOR_MAP[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="font-bold text-gray-900 text-sm">{title}</p>
    </div>
  );
}

function Field({
  label, required, error, hint, children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{hint}</p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function inp() {
  return "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed";
}
