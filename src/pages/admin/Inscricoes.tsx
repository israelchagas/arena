import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase, Inscricao, Evento, Categoria } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import { FAIXAS_JUDO } from "@/lib/utils";
import { calcularIdade } from "@/lib/utils";
import { toast } from "sonner";
import {
  Trophy, ClipboardList, ArrowLeft, Search, CheckCircle,
  XCircle, Clock, User, Calendar, Download, Plus, Pencil, Trash2, X, AlertCircle,
} from "lucide-react";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  confirmado: { label: "Confirmado", cls: "bg-green-100 text-green-700", Icon: CheckCircle },
  pendente:   { label: "Pendente",   cls: "bg-amber-100 text-amber-700",  Icon: Clock },
  cancelado:  { label: "Cancelado",  cls: "bg-red-100 text-red-600",      Icon: XCircle },
};

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  evento_id:              z.string().min(1, "Selecione o evento"),
  professor_id:           z.string().min(1, "Selecione o professor"),
  atleta_nome:            z.string().min(3, "Mínimo 3 caracteres"),
  atleta_data_nascimento: z.string().min(1, "Obrigatório"),
  atleta_sexo:            z.enum(["M", "F"], { required_error: "Selecione o sexo" }),
  categoria_id:           z.string().min(1, "Selecione a categoria"),
  atleta_faixa:           z.string().min(1, "Selecione a graduação"),
  atleta_peso:            z.coerce.number().min(1, "Informe o peso").max(300),
  atleta_cpf:             z.string().optional(),
  atleta_email:           z.string().email("E-mail inválido").optional().or(z.literal("")),
  atleta_telefone:        z.string().optional(),
  responsavel_nome:       z.string().optional(),
  responsavel_cpf:        z.string().optional(),
  status:                 z.enum(["confirmado", "pendente", "cancelado"]),
});

type FormData = z.infer<typeof schema>;

interface ProfessorOpt { id: string; nome: string; associacao_id: string; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminInscricoes() {
  const [, navigate] = useLocation();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [eventos, setEventos] = useState<Pick<Evento, "id" | "nome">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventoFiltro, setEventoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");

  // Modal
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [professores, setProfessores] = useState<ProfessorOpt[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "confirmado" },
  });

  const watchEvento = watch("evento_id");
  const watchSexo   = watch("atleta_sexo");

  const categoriasFiltradas = categorias.filter(
    (c) => !c.sexo || c.sexo === "misto" || c.sexo === watchSexo
  );

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!watchEvento) { setProfessores([]); setCategorias([]); return; }
    loadModalData(watchEvento);
  }, [watchEvento]);

  async function loadData() {
    setLoading(true);
    const [inscRes, evRes] = await Promise.all([
      supabase
        .from("inscricoes")
        .select("*, categorias(nome), associacoes(nome), professores(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("eventos").select("id, nome").order("data_inicio"),
    ]);
    if (inscRes.error) toast.error("Erro ao carregar inscrições");
    setInscricoes((inscRes.data ?? []) as Inscricao[]);
    setEventos(evRes.data ?? []);
    setLoading(false);
  }

  async function loadModalData(eventoId: string) {
    setLoadingModal(true);
    const [profRes, catRes] = await Promise.all([
      supabase.from("professores").select("id, nome, associacao_id").eq("evento_id", eventoId).eq("status", "ativo"),
      supabase.from("categorias").select("*").eq("evento_id", eventoId).order("ordem"),
    ]);
    setProfessores(profRes.data ?? []);
    setCategorias(catRes.data ?? []);
    setLoadingModal(false);
  }

  function openCreate() {
    reset({ status: "confirmado" });
    setEditingId(null);
    setModalMode("create");
  }

  async function openEdit(insc: Inscricao) {
    setEditingId(insc.id);
    setModalMode("edit");
    await loadModalData(insc.evento_id);
    reset({
      evento_id:              insc.evento_id,
      professor_id:           insc.professor_id,
      atleta_nome:            insc.atleta_nome,
      atleta_data_nascimento: insc.atleta_data_nascimento,
      atleta_sexo:            insc.atleta_sexo,
      categoria_id:           insc.categoria_id ?? "",
      atleta_faixa:           insc.atleta_faixa ?? "",
      atleta_peso:            insc.atleta_peso ?? undefined,
      atleta_cpf:             insc.atleta_cpf ?? "",
      atleta_email:           insc.atleta_email ?? "",
      atleta_telefone:        insc.atleta_telefone ?? "",
      responsavel_nome:       insc.responsavel_nome ?? "",
      responsavel_cpf:        insc.responsavel_cpf ?? "",
      status:                 insc.status,
    });
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    reset();
    setProfessores([]);
    setCategorias([]);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    const prof = professores.find((p) => p.id === data.professor_id);

    if (modalMode === "create") {
      const { error } = await supabase.from("inscricoes").insert({
        evento_id:              data.evento_id,
        professor_id:           data.professor_id,
        associacao_id:          prof?.associacao_id ?? "",
        categoria_id:           data.categoria_id,
        atleta_nome:            data.atleta_nome.trim(),
        atleta_cpf:             data.atleta_cpf?.replace(/\D/g, "") || null,
        atleta_data_nascimento: data.atleta_data_nascimento,
        atleta_sexo:            data.atleta_sexo,
        atleta_faixa:           data.atleta_faixa,
        atleta_peso:            data.atleta_peso,
        atleta_email:           data.atleta_email || null,
        atleta_telefone:        data.atleta_telefone || null,
        responsavel_nome:       data.responsavel_nome || null,
        responsavel_cpf:        data.responsavel_cpf?.replace(/\D/g, "") || null,
        status:                 data.status,
      });
      if (error) { toast.error("Erro ao criar: " + error.message); setSaving(false); return; }
      toast.success("Inscrição criada!");
    } else if (editingId) {
      const { error } = await supabase.from("inscricoes").update({
        categoria_id:           data.categoria_id,
        atleta_nome:            data.atleta_nome.trim(),
        atleta_cpf:             data.atleta_cpf?.replace(/\D/g, "") || null,
        atleta_data_nascimento: data.atleta_data_nascimento,
        atleta_sexo:            data.atleta_sexo,
        atleta_faixa:           data.atleta_faixa,
        atleta_peso:            data.atleta_peso,
        atleta_email:           data.atleta_email || null,
        atleta_telefone:        data.atleta_telefone || null,
        responsavel_nome:       data.responsavel_nome || null,
        responsavel_cpf:        data.responsavel_cpf?.replace(/\D/g, "") || null,
        status:                 data.status,
      }).eq("id", editingId);
      if (error) { toast.error("Erro ao salvar: " + error.message); setSaving(false); return; }
      toast.success("Inscrição atualizada!");
    }

    setSaving(false);
    closeModal();
    loadData();
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir inscrição de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    const { error } = await supabase.from("inscricoes").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Inscrição excluída"); setInscricoes((prev) => prev.filter((i) => i.id !== id)); }
    setDeleting(null);
  }

  async function alterarStatus(id: string, status: "confirmado" | "cancelado" | "pendente") {
    const { error } = await supabase.from("inscricoes").update({ status }).eq("id", id);
    if (error) toast.error("Erro ao atualizar status");
    else {
      toast.success("Status atualizado");
      setInscricoes((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    }
  }

  const filtered = inscricoes.filter((i) => {
    const matchSearch = !search || i.atleta_nome.toLowerCase().includes(search.toLowerCase());
    const matchEvento = eventoFiltro === "todos" || i.evento_id === eventoFiltro;
    const matchStatus = statusFiltro === "todos" || i.status === statusFiltro;
    return matchSearch && matchEvento && matchStatus;
  });

  const totais = {
    confirmado: inscricoes.filter((i) => i.status === "confirmado").length,
    pendente:   inscricoes.filter((i) => i.status === "pendente").length,
    cancelado:  inscricoes.filter((i) => i.status === "cancelado").length,
  };

  function exportCSV() {
    const header = "Nome,Data Nasc.,Idade,Sexo,Faixa,Peso,Categoria,Associação,Professor,Status";
    const rows = filtered.map((i) => [
      i.atleta_nome, i.atleta_data_nascimento, calcularIdade(i.atleta_data_nascimento),
      i.atleta_sexo === "M" ? "Masculino" : "Feminino",
      i.atleta_faixa ?? "", i.atleta_peso ?? "",
      (i.categorias as any)?.nome ?? "", (i.associacoes as any)?.nome ?? "",
      (i.professores as any)?.nome ?? "", i.status,
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "inscricoes.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const inp = "w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-blue-400" />
            <span className="font-black text-lg">Arena</span>
            <span className="text-gray-600 mx-2">·</span>
            <span className="text-gray-400 text-sm">Inscrições</span>
          </div>
          <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* Totais */}
          <div className="grid grid-cols-3 gap-4">
            {(["confirmado", "pendente", "cancelado"] as const).map((s) => {
              const cfg = STATUS_CFG[s];
              return (
                <button key={s} onClick={() => setStatusFiltro(statusFiltro === s ? "todos" : s)}
                  className={`bg-white border rounded-2xl p-4 shadow-sm text-left transition-all hover:shadow-md ${statusFiltro === s ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-100"}`}>
                  <p className="text-2xl font-black text-gray-900">{totais[s]}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${cfg.cls}`}>
                    <cfg.Icon className="w-3 h-3" />{cfg.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtros + ações */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar atleta..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={eventoFiltro} onChange={(e) => setEventoFiltro(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todos">Todos os eventos</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all font-semibold">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
              <Plus className="w-4 h-4" /> Nova Inscrição
            </button>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Nenhuma inscrição encontrada</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-500">{filtered.length} inscrição{filtered.length !== 1 ? "ões" : ""}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {filtered.map((i) => {
                  const st = STATUS_CFG[i.status];
                  return (
                    <div key={i.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{i.atleta_nome}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{calcularIdade(i.atleta_data_nascimento)} anos</span>
                            <span>{i.atleta_sexo === "M" ? "Masculino" : "Feminino"}</span>
                            {i.atleta_faixa && <span className="text-purple-600 font-medium">{i.atleta_faixa}</span>}
                            {(i.categorias as any)?.nome && <span className="text-blue-500">{(i.categorias as any).nome}</span>}
                            {(i.associacoes as any)?.nome && <span>{(i.associacoes as any).nome}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                          <st.Icon className="w-3 h-3" />{st.label}
                        </span>
                        <select value={i.status} onChange={(e) => alterarStatus(i.id, e.target.value as any)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="confirmado">Confirmar</option>
                          <option value="pendente">Pendente</option>
                          <option value="cancelado">Cancelar</option>
                        </select>
                        <button onClick={() => openEdit(i)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(i.id, i.atleta_nome)} disabled={deleting === i.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40" title="Excluir">
                          {deleting === i.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Modal Create/Edit ──────────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-sm">{modalMode === "create" ? "Nova Inscrição" : "Editar Inscrição"}</h2>
                  <p className="text-gray-400 text-xs mt-0.5">{modalMode === "create" ? "Cadastrar atleta manualmente" : "Alterar dados do atleta"}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">

              {/* Evento + Professor (só create) */}
              {modalMode === "create" && (
                <Section label="Vínculo">
                  <Field label="Evento" required error={errors.evento_id?.message}>
                    <select {...register("evento_id")} className={inp}>
                      <option value="">Selecione o evento</option>
                      {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Professor" required error={errors.professor_id?.message}>
                    <select {...register("professor_id")} disabled={!watchEvento || loadingModal} className={inp}>
                      <option value="">{!watchEvento ? "Selecione um evento primeiro" : loadingModal ? "Carregando..." : "Selecione o professor"}</option>
                      {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </Field>
                </Section>
              )}

              {/* Dados pessoais */}
              <Section label="Dados do Atleta">
                <Field label="Nome completo" required error={errors.atleta_nome?.message}>
                  <input {...register("atleta_nome")} placeholder="Nome completo" className={inp} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de nascimento" required error={errors.atleta_data_nascimento?.message}>
                    <input {...register("atleta_data_nascimento")} type="date" max={new Date().toISOString().split("T")[0]} className={inp} />
                  </Field>
                  <Field label="Sexo" required error={errors.atleta_sexo?.message}>
                    <select {...register("atleta_sexo")} className={inp}>
                      <option value="">Selecionar</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </Field>
                </div>
                <Field label="CPF" error={errors.atleta_cpf?.message}>
                  <input {...register("atleta_cpf")} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} className={inp} />
                </Field>
              </Section>

              {/* Dados esportivos */}
              <Section label="Dados Esportivos">
                <Field label="Categoria" required error={errors.categoria_id?.message}>
                  <select {...register("categoria_id")} disabled={loadingModal} className={inp}>
                    <option value="">{loadingModal ? "Carregando..." : "Selecione a categoria"}</option>
                    {categoriasFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Graduação (faixa)" required error={errors.atleta_faixa?.message}>
                    <select {...register("atleta_faixa")} className={inp}>
                      <option value="">Selecionar</option>
                      {FAIXAS_JUDO.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                  <Field label="Peso de luta (kg)" required error={errors.atleta_peso?.message}>
                    <input {...register("atleta_peso")} type="number" step="0.1" min="1" max="300" placeholder="Ex: 52.5" className={inp} />
                  </Field>
                </div>
                <Field label="Status" required error={errors.status?.message}>
                  <select {...register("status")} className={inp}>
                    <option value="confirmado">Confirmado</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </Field>
              </Section>

              {/* Responsável */}
              <Section label="Responsável (opcional)">
                <Field label="Nome do responsável" error={errors.responsavel_nome?.message}>
                  <input {...register("responsavel_nome")} placeholder="Nome completo" className={inp} />
                </Field>
                <Field label="CPF do responsável" error={errors.responsavel_cpf?.message}>
                  <input {...register("responsavel_cpf")} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} className={inp} />
                </Field>
              </Section>

              {/* Contato */}
              <Section label="Contato (opcional)">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="E-mail" error={errors.atleta_email?.message}>
                    <input {...register("atleta_email")} type="email" placeholder="atleta@email.com" className={inp} />
                  </Field>
                  <Field label="Telefone" error={errors.atleta_telefone?.message}>
                    <input {...register("atleta_telefone")} type="tel" placeholder="(61) 9 0000-0000" className={inp} />
                  </Field>
                </div>
              </Section>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm transition-all">
                  {saving ? <><Spinner className="w-4 h-4" /> Salvando...</> : modalMode === "create" ? "Criar inscrição" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ── Auxiliares ────────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-red-500 text-xs mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
