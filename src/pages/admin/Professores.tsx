import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase, Professor, Evento, Associacao } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import {
  Trophy, Users, Plus, ArrowLeft, Trash2, X, Mail,
  Phone, Award, RefreshCw, AlertCircle, CheckCircle,
  Clock, Shield, Building2, ThumbsUp, ThumbsDown, Bell,
} from "lucide-react";

// ── CPF helpers ──────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function displayCPF(cpf?: string) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const PALETTES = [
  { bg: "#dbeafe", text: "#1e40af" },
  { bg: "#ede9fe", text: "#6d28d9" },
  { bg: "#fce7f3", text: "#9d174d" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#fee2e2", text: "#991b1b" },
  { bg: "#e0f2fe", text: "#0369a1" },
];

function palette(name: string) {
  const i = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % PALETTES.length;
  return PALETTES[i];
}

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Mínimo 2 caracteres"),
  cpf: z
    .string()
    .min(1, "CPF obrigatório")
    .refine((v) => v.replace(/\D/g, "").length === 11, "CPF inválido"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().optional(),
  graduacao: z.string().optional(),
  evento_id: z.string().min(1, "Selecione o evento"),
  associacao_id: z.string().min(1, "Selecione a associação"),
});

type FormData = z.infer<typeof schema>;

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminProfessores() {
  const [, navigate] = useLocation();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [associacoes, setAssociacoes] = useState<Associacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [eventoFiltro, setEventoFiltro] = useState("todos");

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const eventoSelecionado = watch("evento_id");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [profRes, evRes] = await Promise.all([
      supabase
        .from("professores")
        .select("*, associacoes(nome), eventos(nome)")
        .not("status", "eq", "rejeitado")
        .order("nome"),
      supabase.from("eventos").select("*").order("data_inicio"),
    ]);
    setProfessores((profRes.data ?? []) as Professor[]);
    setEventos(evRes.data ?? []);
    setLoading(false);
  }

  async function loadAssociacoes(eventoId: string) {
    const { data } = await supabase
      .from("associacoes").select("*")
      .eq("evento_id", eventoId).eq("ativo", true);
    setAssociacoes(data ?? []);
  }

  useEffect(() => {
    if (eventoSelecionado) loadAssociacoes(eventoSelecionado);
    else setAssociacoes([]);
  }, [eventoSelecionado]);

  function openNew() {
    reset({ evento_id: "", associacao_id: "", telefone: "", graduacao: "", cpf: "" });
    setAssociacoes([]);
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    const { data: result, error } = await supabase.functions.invoke("invite-professor", {
      body: {
        action: "create",
        nome: data.nome,
        cpf: data.cpf.replace(/\D/g, ""),
        email: data.email,
        telefone: data.telefone || null,
        graduacao: data.graduacao || null,
        evento_id: data.evento_id,
        associacao_id: data.associacao_id,
      },
    });
    if (error || result?.error) {
      toast.error(result?.error ?? "Erro ao cadastrar professor");
    } else {
      toast.success("Professor cadastrado! E-mail com credenciais enviado.");
      setShowForm(false);
      loadData();
    }
    setSaving(false);
  }

  async function handleApprove(p: Professor) {
    setApproving(p.id);
    const { data: result, error } = await supabase.functions.invoke("invite-professor", {
      body: { action: "approve", professor_id: p.id },
    });
    if (error || result?.error) {
      toast.error(result?.error ?? "Erro ao aprovar professor");
    } else {
      toast.success(`${p.nome} aprovado! Credenciais enviadas por e-mail.`);
      loadData();
    }
    setApproving(null);
  }

  async function handleReject(p: Professor) {
    if (!confirm(`Rejeitar o cadastro de "${p.nome}"?`)) return;
    setRejecting(p.id);
    const { data: result, error } = await supabase.functions.invoke("invite-professor", {
      body: { action: "reject", professor_id: p.id },
    });
    if (error || result?.error) {
      toast.error(result?.error ?? "Erro ao rejeitar");
    } else {
      toast.success("Cadastro rejeitado.");
      loadData();
    }
    setRejecting(null);
  }

  async function handleDelete(p: Professor) {
    if (!confirm(`Remover "${p.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(p.id);
    const { error } = await supabase.from("professores").delete().eq("id", p.id);
    if (error) toast.error("Erro ao remover");
    else { toast.success("Professor removido"); loadData(); }
    setDeleting(null);
  }

  async function handleResend(p: Professor) {
    if (!confirm(`Reenviar convite para "${p.nome}"?\nIsso vai gerar uma nova senha.`)) return;
    setResending(p.id);
    const { data: result, error } = await supabase.functions.invoke("invite-professor", {
      body: { action: "resend", professor_id: p.id },
    });
    if (error || result?.error) {
      toast.error(result?.error ?? "Erro ao reenviar");
    } else {
      toast.success(`Novas credenciais enviadas para ${p.email}`);
    }
    setResending(null);
  }

  const allFiltered = eventoFiltro === "todos"
    ? professores
    : professores.filter((p) => p.evento_id === eventoFiltro);

  const pendentes = allFiltered.filter((p) => (p as any).status === "pendente");
  const ativos    = allFiltered.filter((p) => (p as any).status !== "pendente");

  const totalAtivos    = professores.filter((p) => (p as any).status === "ativo" && p.invite_accepted_at).length;
  const totalPendentes = professores.filter((p) => (p as any).status === "pendente").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Professores</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/cadastro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            ↗ Link de cadastro público
          </a>
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat icon={Users}         label="Total"      value={professores.length} color="blue" />
            <Stat icon={CheckCircle}   label="Ativos"     value={totalAtivos}        color="green" />
            <Stat icon={Clock}         label="Pendentes"  value={totalPendentes}     color="amber" pulse={totalPendentes > 0} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Professores</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {allFiltered.length} professor{allFiltered.length !== 1 ? "es" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={eventoFiltro}
              onChange={(e) => setEventoFiltro(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos os eventos</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button
              onClick={openNew}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo Professor
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
        ) : (
          <div className="space-y-6">

            {/* ── Pendentes de aprovação ─────────────────────────────── */}
            {pendentes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <h2 className="font-bold text-gray-800 text-sm">Aguardando aprovação</h2>
                  <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">
                    {pendentes.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {pendentes.map((p) => (
                    <ProfCard
                      key={p.id}
                      professor={p}
                      pending
                      onApprove={() => handleApprove(p)}
                      onReject={() => handleReject(p)}
                      onDelete={() => handleDelete(p)}
                      approving={approving === p.id}
                      rejecting={rejecting === p.id}
                      deleting={deleting === p.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Ativos ────────────────────────────────────────────── */}
            {ativos.length > 0 && (
              <div>
                {pendentes.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <h2 className="font-bold text-gray-800 text-sm">Professores ativos</h2>
                    <span className="bg-green-100 text-green-700 text-xs font-black px-2 py-0.5 rounded-full">
                      {ativos.length}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  {ativos.map((p) => (
                    <ProfCard
                      key={p.id}
                      professor={p}
                      onResend={() => handleResend(p)}
                      onDelete={() => handleDelete(p)}
                      resending={resending === p.id}
                      deleting={deleting === p.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Vazio ─────────────────────────────────────────────── */}
            {pendentes.length === 0 && ativos.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-500">Nenhum professor cadastrado</p>
                <p className="text-sm text-gray-400 mt-1">
                  Clique em "Novo Professor" ou compartilhe o{" "}
                  <a href="/cadastro" target="_blank" className="text-blue-600 font-semibold hover:underline">
                    link de auto-cadastro
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modal Novo Professor ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-sm">Novo Professor</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Credenciais geradas e enviadas por e-mail</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              <Section label="Dados pessoais">
                <Field label="Nome completo" required error={errors.nome?.message}>
                  <input {...register("nome")} placeholder="Ex: Carlos Eduardo Silva" className={inp()} autoComplete="off" />
                </Field>
                <Field label="CPF" required error={errors.cpf?.message}>
                  <input
                    {...register("cpf")} placeholder="000.000.000-00" inputMode="numeric" maxLength={14}
                    onChange={(e) => setValue("cpf", formatCPF(e.target.value), { shouldValidate: true })}
                    className={inp()}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone" error={errors.telefone?.message}>
                    <input {...register("telefone")} placeholder="(61) 9 0000-0000" type="tel" className={inp()} />
                  </Field>
                  <Field label="Graduação" error={errors.graduacao?.message}>
                    <input {...register("graduacao")} placeholder="Ex: Faixa Preta" className={inp()} />
                  </Field>
                </div>
              </Section>

              <Section label="Acesso ao sistema">
                <Field label="E-mail" required error={errors.email?.message}
                  hint="Será o usuário de login — senha temporária enviada automaticamente">
                  <input type="email" {...register("email")} placeholder="professor@email.com" className={inp()} />
                </Field>
              </Section>

              <Section label="Vínculo com o evento">
                <Field label="Evento" required error={errors.evento_id?.message}>
                  <select {...register("evento_id")} className={inp()}>
                    <option value="">Selecione o evento</option>
                    {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </Field>
                <Field label="Associação" required error={errors.associacao_id?.message}>
                  <select {...register("associacao_id")} disabled={!eventoSelecionado || associacoes.length === 0} className={inp()}>
                    <option value="">
                      {!eventoSelecionado ? "Selecione um evento primeiro" : associacoes.length === 0 ? "Nenhuma associação" : "Selecione a associação"}
                    </option>
                    {associacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </Field>
              </Section>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm transition-all">
                  {saving ? <><Spinner className="w-4 h-4" /> Cadastrando...</> : <><Mail className="w-4 h-4" /> Cadastrar e enviar e-mail</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProfCard ─────────────────────────────────────────────────────────────────

function ProfCard({
  professor: p, pending,
  onApprove, onReject, onResend, onDelete,
  approving, rejecting, resending, deleting,
}: {
  professor: Professor;
  pending?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onResend?: () => void;
  onDelete?: () => void;
  approving?: boolean;
  rejecting?: boolean;
  resending?: boolean;
  deleting?: boolean;
}) {
  const pal = palette(p.nome);
  const isActive = !!p.invite_accepted_at;

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md ${pending ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-black"
          style={{ background: pal.bg, color: pal.text }}
        >
          {p.nome.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <p className="font-bold text-gray-900">{p.nome}</p>
            {p.graduacao && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 font-semibold px-2.5 py-0.5 rounded-full">
                <Award className="w-3 h-3" /> {p.graduacao}
              </span>
            )}
            {pending ? (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Aguardando aprovação
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> Ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 font-semibold px-2.5 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Aguardando acesso
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-gray-400 text-xs flex-wrap mb-2">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{p.email}</span>
            {p.telefone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.telefone}</span>}
            {p.cpf && <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" />{displayCPF(p.cpf)}</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {p.associacoes && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                <Building2 className="w-3 h-3" />
                {(p.associacoes as unknown as Associacao).nome}
              </span>
            )}
            {p.eventos && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {(p.eventos as unknown as Evento).nome}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {pending ? (
            <>
              <button
                onClick={onApprove}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-all"
              >
                {approving ? <Spinner className="w-3.5 h-3.5" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                Aprovar
              </button>
              <button
                onClick={onReject}
                disabled={approving || rejecting}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 px-3 py-2 rounded-lg transition-all"
              >
                {rejecting ? <Spinner className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                Rejeitar
              </button>
            </>
          ) : (
            <button
              onClick={onResend}
              disabled={!!resending}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all disabled:opacity-40"
            >
              {resending ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Reenviar
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40"
          >
            {deleting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, color, pulse }: {
  icon: React.ElementType; label: string; value: number; color: string; pulse?: boolean;
}) {
  const cls: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-500",
  };
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${cls[color]}`}>
        <Icon className="w-5 h-5" />
        {pulse && <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse" />}
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

function inp() {
  return "w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed";
}
