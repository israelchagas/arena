import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase, Evento, Categoria } from "@/lib/supabase";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, Calendar, Plus, ArrowLeft, Pencil, Trash2,
  MapPin, CheckCircle, Clock, XCircle, X, Save,
  Lock, AlertTriangle, Eye, EyeOff, ImagePlus, Trash, Award,
  Tag,
} from "lucide-react";
import { formatDateLong } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  modalidade: z.string().min(2, "Informe a modalidade"),
  data_inicio: z.string().min(1, "Obrigatório"),
  data_fim: z.string().min(1, "Obrigatório"),
  data_inicio_inscricoes: z.string().optional(),
  data_fim_inscricoes: z.string().optional(),
  local: z.string().min(2, "Informe o local"),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  status: z.enum(["rascunho", "aberto", "encerrado"]),
  descricao: z.string().optional(),
  max_inscricoes: z.coerce.number().optional(),
  logo_url: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const STATUS_CFG = {
  rascunho:  { label: "Rascunho",  cls: "bg-amber-100 text-amber-700",  Icon: Clock },
  aberto:    { label: "Aberto",    cls: "bg-green-100 text-green-700",   Icon: CheckCircle },
  encerrado: { label: "Encerrado", cls: "bg-gray-100 text-gray-500",     Icon: XCircle },
};

export default function AdminEventos() {
  const [, navigate] = useLocation();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Logo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 2 MB."); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function uploadLogo(eventoId: string): Promise<string | null> {
    if (!logoFile) return null;
    setUploadingLogo(true);
    const ext = logoFile.name.split(".").pop();
    const path = `eventos/${eventoId}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
    setUploadingLogo(false);
    if (error) { toast.error("Erro ao enviar logo"); return null; }
    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
    return publicUrl;
  }

  function clearLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Encerrar evento
  const [encerrando, setEncerrando] = useState<Evento | null>(null);
  const [senhaEncerrar, setSenhaEncerrar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [encerrando_loading, setEncerrando_loading] = useState(false);

  // Reabrir evento
  const [reabrindo, setReabrindo] = useState<Evento | null>(null);
  const [senhaReabrir, setSenhaReabrir] = useState("");
  const [showSenhaReabrir, setShowSenhaReabrir] = useState(false);
  const [reabrindo_loading, setReabrindo_loading] = useState(false);

  // Categorias
  const [catEvento, setCatEvento] = useState<Evento | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const emptyCat = { nome: "", sexo: "misto" as "M" | "F" | "misto", idade_min: "", idade_max: "", peso_min: "", peso_max: "" };
  const [catForm, setCatForm] = useState(emptyCat);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "rascunho", modalidade: "Judô", uf: "DF" },
  });

  useEffect(() => { loadEventos(); }, []);

  async function loadEventos() {
    setLoading(true);
    const { data } = await supabase.from("eventos").select("*").order("data_inicio", { ascending: true });
    setEventos(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    reset({ status: "rascunho", modalidade: "Judô", uf: "DF" });
    setLogoFile(null);
    setLogoPreview(null);
    setShowForm(true);
  }

  function openEdit(ev: Evento) {
    setEditing(ev);
    setLogoFile(null);
    setLogoPreview(ev.logo_url ?? null);
    reset({
      nome: ev.nome,
      modalidade: ev.modalidade,
      data_inicio: ev.data_inicio,
      data_fim: ev.data_fim,
      data_inicio_inscricoes: ev.data_inicio_inscricoes ? ev.data_inicio_inscricoes.slice(0, 16) : "",
      data_fim_inscricoes: ev.data_fim_inscricoes ? ev.data_fim_inscricoes.slice(0, 16) : "",
      local: ev.local,
      cidade: ev.cidade ?? "",
      uf: ev.uf ?? "DF",
      status: ev.status,
      descricao: ev.descricao ?? "",
      max_inscricoes: ev.max_inscricoes ?? undefined,
      logo_url: ev.logo_url ?? "",
    });
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);

    // Resolve logo_url: mantém existente se não trocou
    let logo_url = editing?.logo_url ?? null;

    if (editing) {
      // Faz upload e salva
      if (logoFile) {
        const url = await uploadLogo(editing.id);
        if (url) logo_url = url;
      } else if (!logoPreview) {
        logo_url = null; // usuário removeu
      }
      const payload = { nome: data.nome, modalidade: data.modalidade, data_inicio: data.data_inicio, data_fim: data.data_fim, data_inicio_inscricoes: data.data_inicio_inscricoes || null, data_fim_inscricoes: data.data_fim_inscricoes || null, local: data.local, cidade: data.cidade || null, uf: data.uf || null, status: data.status, descricao: data.descricao || null, max_inscricoes: data.max_inscricoes || null, logo_url };
      const { error } = await supabase.from("eventos").update(payload).eq("id", editing.id);
      if (error) toast.error("Erro ao salvar");
      else { toast.success("Evento atualizado!"); setShowForm(false); loadEventos(); }
    } else {
      // Cria primeiro, depois faz upload com o ID gerado
      const payload = { nome: data.nome, modalidade: data.modalidade, data_inicio: data.data_inicio, data_fim: data.data_fim, data_inicio_inscricoes: data.data_inicio_inscricoes || null, data_fim_inscricoes: data.data_fim_inscricoes || null, local: data.local, cidade: data.cidade || null, uf: data.uf || null, status: data.status, descricao: data.descricao || null, max_inscricoes: data.max_inscricoes || null, logo_url: null };
      const { data: created, error } = await supabase.from("eventos").insert(payload).select("id").single();
      if (error || !created) { toast.error("Erro ao criar"); setSaving(false); return; }

      if (logoFile) {
        const url = await uploadLogo(created.id);
        if (url) await supabase.from("eventos").update({ logo_url: url }).eq("id", created.id);
      }
      toast.success("Evento criado!"); setShowForm(false); loadEventos();
    }
    setSaving(false);
  }

  async function handleDelete(ev: Evento) {
    if (!confirm(`Excluir "${ev.nome}"?`)) return;
    setDeleting(ev.id);
    const { error } = await supabase.from("eventos").delete().eq("id", ev.id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Excluído"); loadEventos(); }
    setDeleting(null);
  }

  // ── Encerrar evento ─────────────────────────────────────────────────────────
  function abrirEncerrar(ev: Evento) {
    setSenhaEncerrar("");
    setEncerrando(ev);
  }

  function encerrarRequerSenha(ev: Evento): boolean {
    // Requer senha se a data fim do evento ainda não passou
    const fim = new Date(ev.data_fim + "T23:59:59");
    return new Date() < fim;
  }

  async function confirmarEncerrar() {
    if (!encerrando) return;
    setEncerrando_loading(true);

    if (encerrarRequerSenha(encerrando)) {
      // Verifica senha do admin atual
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (!email) { toast.error("Sessão expirada"); setEncerrando_loading(false); return; }

      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: senhaEncerrar });
      if (authErr) {
        toast.error("Senha incorreta. Encerramento cancelado.");
        setEncerrando_loading(false);
        return;
      }
    }

    const { error } = await supabase.from("eventos").update({
      status: "encerrado",
      encerrado_em: new Date().toISOString(),
    }).eq("id", encerrando.id);

    if (error) toast.error("Erro ao encerrar evento");
    else {
      toast.success(`Evento "${encerrando.nome}" encerrado. Certificados liberados.`);
      setEncerrando(null);
      loadEventos();
    }
    setEncerrando_loading(false);
  }

  // ── Categorias ──────────────────────────────────────────────────────────────
  async function abrirCategorias(ev: Evento) {
    setCatEvento(ev);
    setCatForm(emptyCat);
    setEditingCat(null);
    setCatLoading(true);
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .eq("evento_id", ev.id)
      .order("ordem");
    setCategorias(data ?? []);
    setCatLoading(false);
  }

  function startEditCat(cat: Categoria) {
    setEditingCat(cat);
    setCatForm({
      nome: cat.nome,
      sexo: cat.sexo ?? "misto",
      idade_min: cat.idade_min?.toString() ?? "",
      idade_max: cat.idade_max?.toString() ?? "",
      peso_min: cat.peso_min?.toString() ?? "",
      peso_max: cat.peso_max?.toString() ?? "",
    });
  }

  async function saveCat() {
    if (!catEvento || !catForm.nome.trim()) return;
    setCatSaving(true);

    const payload = {
      evento_id: catEvento.id,
      nome: catForm.nome.trim(),
      sexo: catForm.sexo,
      idade_min: catForm.idade_min ? Number(catForm.idade_min) : null,
      idade_max: catForm.idade_max ? Number(catForm.idade_max) : null,
      peso_min: catForm.peso_min ? Number(catForm.peso_min) : null,
      peso_max: catForm.peso_max ? Number(catForm.peso_max) : null,
      ordem: editingCat ? editingCat.ordem : (categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem)) + 1 : 1),
    };

    let error;
    if (editingCat) {
      ({ error } = await supabase.from("categorias").update(payload).eq("id", editingCat.id));
    } else {
      ({ error } = await supabase.from("categorias").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar categoria");
    } else {
      toast.success(editingCat ? "Categoria atualizada!" : "Categoria adicionada!");
      setCatForm(emptyCat);
      setEditingCat(null);
      const { data } = await supabase.from("categorias").select("*").eq("evento_id", catEvento.id).order("ordem");
      setCategorias(data ?? []);
    }
    setCatSaving(false);
  }

  async function deleteCat(cat: Categoria) {
    if (!confirm(`Excluir categoria "${cat.nome}"?`)) return;
    const { error } = await supabase.from("categorias").delete().eq("id", cat.id);
    if (error) toast.error("Erro ao excluir");
    else {
      setCategorias((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success("Categoria excluída");
    }
  }

  async function confirmarReabrir() {
    if (!reabrindo) return;
    setReabrindo_loading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;
    if (!email) { toast.error("Sessão expirada"); setReabrindo_loading(false); return; }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: senhaReabrir });
    if (authErr) {
      toast.error("Senha incorreta. Reabertura cancelada.");
      setReabrindo_loading(false);
      return;
    }

    const { error } = await supabase.from("eventos").update({
      status: "aberto",
      encerrado_em: null,
      encerrado_por: null,
    }).eq("id", reabrindo.id);

    if (error) toast.error("Erro ao reabrir evento");
    else {
      toast.success(`Evento "${reabrindo.nome}" reaberto. Inscrições ativas novamente.`);
      setReabrindo(null);
      loadEventos();
    }
    setReabrindo_loading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-blue-400" />
          <span className="font-black text-lg">Arena</span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-gray-400 text-sm">Eventos</span>
        </div>
        <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Eventos</h1>
            <p className="text-gray-400 text-sm mt-0.5">{eventos.length} cadastrado{eventos.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-sm transition-all">
            <Plus className="w-4 h-4" /> Novo Evento
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner className="w-8 h-8 text-blue-600" /></div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Nenhum evento cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map((ev) => {
              const st = STATUS_CFG[ev.status];
              const podeEncerrar = ev.status !== "encerrado";
              return (
                <div key={ev.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-gray-900">{ev.nome}</h2>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${st.cls}`}>
                          <st.Icon className="w-3 h-3" />{st.label}
                        </span>
                      </div>

                      {/* Datas evento */}
                      <div className="flex items-center gap-4 mt-2 text-gray-400 text-xs flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <strong className="text-gray-600">Evento:</strong>&nbsp;
                          {formatDateLong(ev.data_inicio)}
                          {ev.data_fim !== ev.data_inicio && ` — ${formatDateLong(ev.data_fim)}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {ev.local}{ev.cidade ? `, ${ev.cidade}` : ""}
                        </span>
                        <span className="text-blue-500 font-medium">{ev.modalidade}</span>
                      </div>

                      {/* Datas inscrições */}
                      {(ev.data_inicio_inscricoes || ev.data_fim_inscricoes) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          <strong className="text-gray-500">Inscrições:</strong>&nbsp;
                          {ev.data_inicio_inscricoes
                            ? new Date(ev.data_inicio_inscricoes).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                          {" "}&rarr;{" "}
                          {ev.data_fim_inscricoes
                            ? new Date(ev.data_fim_inscricoes).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </div>
                      )}

                      {ev.encerrado_em && (
                        <p className="text-xs text-gray-400 mt-1">
                          Encerrado em {new Date(ev.encerrado_em).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(ev)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(ev)} disabled={deleting === ev.id} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40">
                        {deleting === ev.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => abrirCategorias(ev)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-lg transition-all border border-teal-100"
                    >
                      <Tag className="w-3.5 h-3.5" /> Categorias
                    </button>
                    <button
                      onClick={() => navigate(`/admin/certificado/${ev.id}`)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-all border border-purple-100"
                    >
                      <Award className="w-3.5 h-3.5" /> Editar certificado
                    </button>
                    {podeEncerrar && (
                      <button
                        onClick={() => abrirEncerrar(ev)}
                        className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-all border border-red-100"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Encerrar evento
                      </button>
                    )}
                    {ev.status === "encerrado" && (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded-lg font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Certificados liberados
                        </span>
                        <button
                          onClick={() => { setSenhaReabrir(""); setShowSenhaReabrir(false); setReabrindo(ev); }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-all border border-amber-100"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Reabrir evento
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal Formulário ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-black text-gray-900">{editing ? "Editar Evento" : "Novo Evento"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <Field label="Nome do Evento" error={errors.nome?.message}>
                <input {...register("nome")} placeholder="Ex: Festival de Judô 2025" className={inp()} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Modalidade" error={errors.modalidade?.message}>
                  <input {...register("modalidade")} placeholder="Judô" className={inp()} />
                </Field>
                <Field label="Status" error={errors.status?.message}>
                  <select {...register("status")} className={inp()}>
                    <option value="rascunho">Rascunho</option>
                    <option value="aberto">Aberto</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </Field>
              </div>

              {/* Datas do evento */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Datas do Evento</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início" error={errors.data_inicio?.message}>
                    <input type="date" {...register("data_inicio")} className={inp()} />
                  </Field>
                  <Field label="Fim" error={errors.data_fim?.message}>
                    <input type="date" {...register("data_fim")} className={inp()} />
                  </Field>
                </div>
              </div>

              {/* Datas das inscrições */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Período de Inscrições</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Abertura" error={errors.data_inicio_inscricoes?.message}>
                    <input type="datetime-local" {...register("data_inicio_inscricoes")} className={inp()} />
                  </Field>
                  <Field label="Encerramento" error={errors.data_fim_inscricoes?.message}>
                    <input type="datetime-local" {...register("data_fim_inscricoes")} className={inp()} />
                  </Field>
                </div>
              </div>

              <Field label="Local" error={errors.local?.message}>
                <input {...register("local")} placeholder="Ex: Ginásio Municipal" className={inp()} />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Cidade" error={errors.cidade?.message}>
                    <input {...register("cidade")} placeholder="Brasília" className={inp()} />
                  </Field>
                </div>
                <Field label="UF" error={errors.uf?.message}>
                  <input {...register("uf")} placeholder="DF" maxLength={2} className={inp()} />
                </Field>
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logotipo (opcional)</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <img src={logoPreview} alt="Logo" className="w-14 h-14 object-contain rounded-lg bg-white border border-gray-100 p-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">{logoFile?.name ?? "Logo atual"}</p>
                      <p className="text-xs text-gray-400">{logoFile ? `${(logoFile.size / 1024).toFixed(0)} KB` : "Clique para trocar"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                        <ImagePlus className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={clearLogo} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 py-5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-sm font-medium">Selecionar arquivo</span>
                    <span className="text-xs">PNG, JPG, SVG · até 2 MB</span>
                  </button>
                )}
                {uploadingLogo && <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><Spinner className="w-3 h-3" /> Enviando logo...</p>}
              </div>

              <Field label="Máx. inscrições (opcional)" error={errors.max_inscricoes?.message}>
                <input type="number" {...register("max_inscricoes")} placeholder="Sem limite" className={inp()} />
              </Field>

              <Field label="Descrição (opcional)" error={errors.descricao?.message}>
                <textarea {...register("descricao")} rows={3} placeholder="Informações adicionais..." className={inp()} />
              </Field>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm transition-all">
                  {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saving ? "Salvando..." : editing ? "Salvar" : "Criar evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Encerrar Evento ───────────────────────────────────────────── */}
      {encerrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-black text-gray-900">Encerrar Evento</h2>
                <p className="text-gray-400 text-sm">{encerrando.nome}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {encerrarRequerSenha(encerrando) ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-800 font-semibold text-sm">Encerramento antecipado</p>
                      <p className="text-amber-700 text-xs mt-0.5">
                        A data de fim do evento é <strong>{formatDateLong(encerrando.data_fim)}</strong>, mas ainda não chegou.
                        Para encerrar agora, confirme sua senha de administrador.
                      </p>
                    </div>
                  </div>

                  <Field label="Senha do administrador" error={undefined}>
                    <div className="relative">
                      <input
                        type={showSenha ? "text" : "password"}
                        value={senhaEncerrar}
                        onChange={(e) => setSenhaEncerrar(e.target.value)}
                        placeholder="Digite sua senha"
                        className={inp()}
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                </>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-blue-800 text-sm">
                    O evento está dentro do período previsto. Confirme para encerrar e liberar os certificados.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-400">
                Esta ação muda o status para <strong>Encerrado</strong> e libera a emissão de certificados pelos atletas.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => setEncerrando(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button
                  onClick={confirmarEncerrar}
                  disabled={encerrando_loading || (encerrarRequerSenha(encerrando) && !senhaEncerrar)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-bold text-sm transition-all"
                >
                  {encerrando_loading ? <Spinner className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {encerrando_loading ? "Encerrando..." : "Encerrar evento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Categorias ───────────────────────────────────────────────── */}
      {catEvento && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center">
                  <Tag className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="font-black text-gray-900 text-sm">Categorias</h2>
                  <p className="text-gray-400 text-xs truncate max-w-xs">{catEvento.nome}</p>
                </div>
              </div>
              <button onClick={() => { setCatEvento(null); setEditingCat(null); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário de adição / edição */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-gray-50/60">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                {editingCat ? `Editando: ${editingCat.nome}` : "Nova categoria"}
              </p>

              {/* Nome + Sexo */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    placeholder="Ex: Infantil A"
                    value={catForm.nome}
                    onChange={(e) => setCatForm((f) => ({ ...f, nome: e.target.value }))}
                    className={inp()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sexo</label>
                  <select
                    value={catForm.sexo}
                    onChange={(e) => setCatForm((f) => ({ ...f, sexo: e.target.value as any }))}
                    className={inp()}
                  >
                    <option value="misto">Misto</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>

              {/* Idades + Pesos */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Faixa de idade (anos)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" max="99" placeholder="Mín"
                      value={catForm.idade_min}
                      onChange={(e) => setCatForm((f) => ({ ...f, idade_min: e.target.value }))}
                      className={inp()}
                    />
                    <span className="text-gray-400 text-sm flex-shrink-0">até</span>
                    <input
                      type="number" min="0" max="99" placeholder="Máx"
                      value={catForm.idade_max}
                      onChange={(e) => setCatForm((f) => ({ ...f, idade_max: e.target.value }))}
                      className={inp()}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Faixa de peso (kg)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="0" step="0.1" placeholder="Mín"
                      value={catForm.peso_min}
                      onChange={(e) => setCatForm((f) => ({ ...f, peso_min: e.target.value }))}
                      className={inp()}
                    />
                    <span className="text-gray-400 text-sm flex-shrink-0">até</span>
                    <input
                      type="number" min="0" step="0.1" placeholder="Máx"
                      value={catForm.peso_max}
                      onChange={(e) => setCatForm((f) => ({ ...f, peso_max: e.target.value }))}
                      className={inp()}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {editingCat && (
                  <button
                    type="button"
                    onClick={() => { setEditingCat(null); setCatForm(emptyCat); }}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-100 transition-all"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={saveCat}
                  disabled={catSaving || !catForm.nome.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white text-sm font-bold transition-all"
                >
                  {catSaving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {catSaving ? "Salvando..." : editingCat ? "Salvar alterações" : "Adicionar categoria"}
                </button>
              </div>
            </div>

            {/* Lista de categorias */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {catLoading ? (
                <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-teal-600" /></div>
              ) : categorias.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">Nenhuma categoria cadastrada</p>
                  <p className="text-xs mt-1">Use o formulário acima para adicionar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {categorias.map((cat) => {
                    const sexoCfg = {
                      M: { label: "Masculino", cls: "bg-blue-100 text-blue-700" },
                      F: { label: "Feminino", cls: "bg-rose-100 text-rose-700" },
                      misto: { label: "Misto", cls: "bg-purple-100 text-purple-700" },
                    }[cat.sexo ?? "misto"];

                    return (
                      <div key={cat.id} className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${editingCat?.id === cat.id ? "border-teal-300 bg-teal-50" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{cat.nome}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sexoCfg.cls}`}>
                                {sexoCfg.label}
                              </span>
                              {(cat.idade_min || cat.idade_max) && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {cat.idade_min ?? "—"} – {cat.idade_max ?? "—"} anos
                                </span>
                              )}
                              {(cat.peso_min || cat.peso_max) && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {cat.peso_min ?? "—"} – {cat.peso_max ?? "—"} kg
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEditCat(cat)}
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCat(cat)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Reabrir Evento ────────────────────────────────────────────── */}
      {reabrindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-black text-gray-900">Reabrir Evento</h2>
                <p className="text-gray-400 text-sm">{reabrindo.nome}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm">Ação administrativa</p>
                  <p className="text-amber-700 text-xs mt-0.5">
                    Reabrir o evento muda o status para <strong>Aberto</strong> e suspende a emissão de certificados até que seja encerrado novamente.
                  </p>
                </div>
              </div>

              <Field label="Confirme sua senha de administrador" error={undefined}>
                <div className="relative">
                  <input
                    type={showSenhaReabrir ? "text" : "password"}
                    value={senhaReabrir}
                    onChange={(e) => setSenhaReabrir(e.target.value)}
                    placeholder="Digite sua senha"
                    className={inp()}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowSenhaReabrir(!showSenhaReabrir)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSenhaReabrir ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex gap-3">
                <button type="button" onClick={() => setReabrindo(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button
                  onClick={confirmarReabrir}
                  disabled={reabrindo_loading || !senhaReabrir}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm transition-all"
                >
                  {reabrindo_loading ? <Spinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {reabrindo_loading ? "Reabrindo..." : "Reabrir evento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function inp() {
  return "w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all";
}
