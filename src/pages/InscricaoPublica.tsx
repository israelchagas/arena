import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase, Professor, Evento, Categoria } from "@/lib/supabase";
import { FAIXAS_JUDO } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import {
  Trophy, CheckCircle, AlertCircle, User, Dumbbell, Phone,
  Shield, HelpCircle, Calendar, MapPin, XCircle,
} from "lucide-react";

// ── Helpers CPF ──────────────────────────────────────────────────────────────

function formatCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const cpfValido = (v: string) => v.replace(/\D/g, "").length === 11;

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  atleta_nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  atleta_cpf: z
    .string()
    .optional()
    .refine((v) => !v || cpfValido(v), "CPF inválido (11 dígitos)"),
  atleta_data_nascimento: z.string().min(1, "Data de nascimento obrigatória"),
  atleta_sexo: z.enum(["M", "F"], { required_error: "Selecione o sexo" }),
  categoria_id: z.string().min(1, "Selecione uma categoria"),
  atleta_faixa: z.string().min(1, "Selecione a graduação"),
  atleta_peso: z.coerce.number().min(1, "Informe o peso").max(300, "Peso inválido"),
  atleta_email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  atleta_telefone: z.string().optional(),
  responsavel_nome: z.string().min(3, "Nome do responsável obrigatório"),
  responsavel_cpf: z
    .string()
    .min(1, "CPF do responsável obrigatório")
    .refine(cpfValido, "CPF inválido (11 dígitos)"),
});

type FormData = z.infer<typeof schema>;

// ── Componentes auxiliares ───────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {msg}
    </p>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, subtitle, color = "blue" }: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color?: "blue" | "purple";
}) {
  const cls = color === "purple"
    ? "bg-purple-50 text-purple-600"
    : "bg-blue-50 text-blue-600";
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
        <p className="text-gray-400 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all";

// ── Página principal ─────────────────────────────────────────────────────────

export default function InscricaoPublica({ professorId }: { professorId?: string }) {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const sexoSelecionado = watch("atleta_sexo");

  const categoriasFiltradas = categorias.filter(
    (c) => !c.sexo || c.sexo === "misto" || c.sexo === sexoSelecionado
  );

  useEffect(() => {
    if (professorId) loadData();
    else setNotFound(true);
  }, [professorId]);

  async function loadData() {
    const { data: prof, error } = await supabase
      .from("professores")
      .select("*, associacoes(*), eventos(*)")
      .eq("id", professorId)
      .eq("status", "ativo")
      .single();

    if (error || !prof) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const ev = prof.eventos as Evento;
    if (!ev || ev.status !== "aberto") {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfessor(prof);
    setEvento(ev);

    const { data: cats } = await supabase
      .from("categorias")
      .select("*")
      .eq("evento_id", prof.evento_id)
      .order("ordem");

    setCategorias(cats ?? []);
    setLoading(false);
  }

  function handleCPF(field: "atleta_cpf" | "responsavel_cpf") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, formatCPF(e.target.value), { shouldValidate: true });
    };
  }

  async function onSubmit(data: FormData) {
    if (!professor) return;
    setSubmitting(true);

    const { error } = await supabase.from("inscricoes").insert({
      evento_id: professor.evento_id,
      professor_id: professor.id,
      associacao_id: professor.associacao_id,
      categoria_id: data.categoria_id,
      atleta_nome: data.atleta_nome.trim(),
      atleta_cpf: data.atleta_cpf?.replace(/\D/g, "") || null,
      atleta_data_nascimento: data.atleta_data_nascimento,
      atleta_sexo: data.atleta_sexo,
      atleta_faixa: data.atleta_faixa,
      atleta_peso: data.atleta_peso,
      atleta_email: data.atleta_email || null,
      atleta_telefone: data.atleta_telefone || null,
      responsavel_nome: data.responsavel_nome.trim(),
      responsavel_cpf: data.responsavel_cpf.replace(/\D/g, ""),
      status: "confirmado",
    });

    setSubmitting(false);

    if (error) {
      toast.error("Erro ao salvar inscrição. Tente novamente.");
      return;
    }

    setSucesso(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <Spinner className="w-8 h-8 text-blue-400" />
      </div>
    );
  }

  // ── Not found / encerrado ────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Link inválido ou encerrado</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Este link de inscrição não está disponível. Verifique com seu professor se o evento ainda está com inscrições abertas.
          </p>
        </div>
      </div>
    );
  }

  // ── Sucesso ──────────────────────────────────────────────────────────────

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Inscrição realizada!</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Inscrição enviada com sucesso para o professor{" "}
            <strong className="text-gray-800">{professor?.nome}</strong>.
          </p>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Evento</p>
            <p className="font-bold text-gray-900 text-sm">{evento?.nome}</p>
            {evento?.data_inicio && (
              <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                {new Date(evento.data_inicio + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
            {evento?.local && (
              <p className="text-gray-500 text-xs mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {evento.local}
              </p>
            )}
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            Guarde este comprovante. No dia do evento apresente o QR Code que será enviado pelo seu professor.
          </p>
        </div>
      </div>
    );
  }

  // ── Formulário ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">

      {/* ── Cabeçalho ───────────────────────────────────────────── */}
      <div className="px-4 pt-8 pb-6 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white text-lg">Arena</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-1">Inscrição de Atleta</h1>
        <p className="text-blue-300 text-sm font-medium">{evento?.nome}</p>

        {evento && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-blue-400 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(evento.data_inicio + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
            <span className="text-blue-600">·</span>
            <span className="text-blue-400 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {evento.local}
            </span>
          </div>
        )}

        <div className="inline-flex items-center gap-2 mt-3 bg-white/10 border border-white/10 rounded-full px-4 py-1.5">
          <span className="text-blue-300 text-xs">Professor:</span>
          <span className="text-white font-semibold text-xs">{professor?.nome}</span>
          <span className="text-blue-500 text-xs">·</span>
          <span className="text-blue-300 text-xs">{(professor?.associacoes as any)?.nome}</span>
        </div>
      </div>

      {/* ── Formulário ──────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

          {/* Seção 1: Dados do atleta */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <SectionTitle
              icon={User}
              title="Dados do Atleta"
              subtitle="Informações pessoais do competidor"
            />

            <div className="mb-4">
              <Label required>Nome completo</Label>
              <input
                {...register("atleta_nome")}
                type="text"
                placeholder="Ex: João Pedro Silva"
                autoComplete="off"
                className={inputCls}
              />
              <FieldError msg={errors.atleta_nome?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label required>Data de nascimento</Label>
                <input
                  {...register("atleta_data_nascimento")}
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  className={inputCls}
                />
                <FieldError msg={errors.atleta_data_nascimento?.message} />
              </div>
              <div>
                <Label required>Sexo</Label>
                <select {...register("atleta_sexo")} className={inputCls}>
                  <option value="">Selecionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                <FieldError msg={errors.atleta_sexo?.message} />
              </div>
            </div>

            <div>
              <Label>
                CPF do atleta{" "}
                <span className="text-gray-400 font-normal">(opcional — informe apenas se possuir)</span>
              </Label>
              <input
                {...register("atleta_cpf")}
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                onChange={handleCPF("atleta_cpf")}
                className={inputCls}
              />
              <FieldError msg={errors.atleta_cpf?.message} />
            </div>
          </div>

          {/* Seção 2: Dados esportivos */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <SectionTitle
              icon={Dumbbell}
              title="Dados Esportivos"
              subtitle="Categoria, graduação e peso de competição"
            />

            <div className="mb-4">
              <Label required>Categoria</Label>
              {!sexoSelecionado ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-amber-700 text-xs">Selecione o sexo primeiro para ver as categorias disponíveis.</p>
                </div>
              ) : categoriasFiltradas.length === 0 ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="text-gray-500 text-xs">Nenhuma categoria disponível para este sexo. Contate o organizador.</p>
                </div>
              ) : (
                <select {...register("categoria_id")} className={inputCls}>
                  <option value="">Selecionar categoria</option>
                  {categoriasFiltradas.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                      {cat.peso_min && cat.peso_max ? ` (${cat.peso_min}–${cat.peso_max} kg)` : ""}
                      {cat.idade_min && cat.idade_max ? ` · ${cat.idade_min}–${cat.idade_max} anos` : ""}
                    </option>
                  ))}
                </select>
              )}
              <FieldError msg={errors.categoria_id?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Graduação (faixa)</Label>
                <select {...register("atleta_faixa")} className={inputCls}>
                  <option value="">Selecionar</option>
                  {FAIXAS_JUDO.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <FieldError msg={errors.atleta_faixa?.message} />
              </div>
              <div>
                <Label required>Peso de luta (kg)</Label>
                <input
                  {...register("atleta_peso")}
                  type="number"
                  step="0.1"
                  min="1"
                  max="300"
                  placeholder="Ex: 52.5"
                  className={inputCls}
                />
                <FieldError msg={errors.atleta_peso?.message} />
                <p className="text-gray-400 text-xs mt-1">Peso no momento da competição</p>
              </div>
            </div>
          </div>

          {/* Seção 3: Responsável */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <SectionTitle
              icon={Shield}
              title="Responsável"
              subtitle="Nome e CPF do responsável pelo atleta"
              color="purple"
            />

            <div className="mb-4">
              <Label required>Nome completo do responsável</Label>
              <input
                {...register("responsavel_nome")}
                type="text"
                placeholder="Ex: Maria Aparecida Silva"
                autoComplete="off"
                className={inputCls}
              />
              <FieldError msg={errors.responsavel_nome?.message} />
            </div>

            <div>
              <Label required>CPF do responsável</Label>
              <input
                {...register("responsavel_cpf")}
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                maxLength={14}
                onChange={handleCPF("responsavel_cpf")}
                className={inputCls}
              />
              <FieldError msg={errors.responsavel_cpf?.message} />
            </div>
          </div>

          {/* Seção 4: Contato (opcional) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <SectionTitle
              icon={Phone}
              title="Contato do Atleta"
              subtitle="Opcional — para comunicações do evento"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>E-mail</Label>
                <input
                  {...register("atleta_email")}
                  type="email"
                  placeholder="atleta@email.com"
                  autoComplete="off"
                  className={inputCls}
                />
                <FieldError msg={errors.atleta_email?.message} />
              </div>
              <div>
                <Label>Telefone / WhatsApp</Label>
                <input
                  {...register("atleta_telefone")}
                  type="tel"
                  placeholder="(61) 9 0000-0000"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Botão de envio */}
          <div className="pb-8">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 rounded-xl text-base transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <Spinner className="w-5 h-5" />
                  Enviando inscrição...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar inscrição
                </>
              )}
            </button>
            <p className="text-center text-blue-300/60 text-xs mt-3">
              Os dados serão enviados ao organizador do evento.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
