import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Professor, Evento, Inscricao, Categoria } from "@/lib/supabase";
import { formatDateLong, calcularIdade, FAIXAS_JUDO } from "@/lib/utils";
import { Spinner } from "@/components/ui/Spinner";
import {
  Trophy, Calendar, MapPin, Users, PlusCircle, LogOut,
  QrCode, CheckCircle, BookOpen, ClipboardList,
  Clock, ChevronDown, ChevronUp, ChevronRight, Star, AlertCircle,
  X, Share2, Download, Link2, Copy, Check, Pencil, Trash2,
} from "lucide-react";

const editSchema = z.object({
  atleta_nome:            z.string().min(3, "Mínimo 3 caracteres"),
  atleta_data_nascimento: z.string().min(1, "Obrigatório"),
  atleta_sexo:            z.enum(["M", "F"]),
  categoria_id:           z.string().min(1, "Selecione a categoria"),
  atleta_faixa:           z.string().min(1, "Selecione a graduação"),
  atleta_peso:            z.coerce.number().min(1, "Informe o peso").max(300),
  atleta_cpf:             z.string().optional(),
  atleta_email:           z.string().email("E-mail inválido").optional().or(z.literal("")),
  atleta_telefone:        z.string().optional(),
  responsavel_nome:       z.string().optional(),
  responsavel_cpf:        z.string().optional(),
});
type EditData = z.infer<typeof editSchema>;

export default function ProfessorDashboard() {
  const { profile, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [guiaAberto, setGuiaAberto] = useState(true);
  const [qrModal, setQrModal] = useState<Inscricao | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [editModal, setEditModal] = useState<Inscricao | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editForm = useForm<EditData>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (profile) loadData();
  }, [profile]);

  async function loadData() {
    if (!profile) return;

    // Busca o professor pelo profile_id
    const { data: prof } = await supabase
      .from("professores")
      .select("*, associacoes(*), eventos(*)")
      .eq("profile_id", profile.id)
      .single();

    if (!prof) { setLoading(false); return; }

    if (!prof.invite_accepted_at) {
      await supabase
        .from("professores")
        .update({ invite_accepted_at: new Date().toISOString() })
        .eq("id", prof.id);
      prof.invite_accepted_at = new Date().toISOString();
    }

    setProfessor(prof);
    setEvento((prof.eventos as Evento) ?? null);

    // Busca inscrições deste professor
    const { data: insc } = await supabase
      .from("inscricoes")
      .select("*, categorias(*)")
      .eq("professor_id", prof.id)
      .order("created_at", { ascending: false });

    setInscricoes(insc ?? []);
    setLoading(false);
  }

  function copiarLink() {
    if (!professor) return;
    const url = `${window.location.origin}/inscrever/${professor.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  function compartilharLinkWhatsApp() {
    if (!professor) return;
    const url = `${window.location.origin}/inscrever/${professor.id}`;
    const msg = encodeURIComponent(
      `🏆 *${evento?.nome ?? "Evento"}*\n\nUse o link abaixo para realizar sua inscrição:\n${url}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  async function openEdit(insc: Inscricao) {
    if (!professor) return;
    if (categorias.length === 0) {
      const { data } = await supabase.from("categorias").select("*").eq("evento_id", professor.evento_id).order("ordem");
      setCategorias(data ?? []);
    }
    editForm.reset({
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
    });
    setEditModal(insc);
  }

  async function onEditSubmit(data: EditData) {
    if (!editModal) return;
    setSavingEdit(true);
    const { error } = await supabase.from("inscricoes").update({
      atleta_nome:            data.atleta_nome.trim(),
      atleta_data_nascimento: data.atleta_data_nascimento,
      atleta_sexo:            data.atleta_sexo,
      categoria_id:           data.categoria_id,
      atleta_faixa:           data.atleta_faixa,
      atleta_peso:            data.atleta_peso,
      atleta_cpf:             data.atleta_cpf?.replace(/\D/g, "") || null,
      atleta_email:           data.atleta_email || null,
      atleta_telefone:        data.atleta_telefone || null,
      responsavel_nome:       data.responsavel_nome || null,
      responsavel_cpf:        data.responsavel_cpf?.replace(/\D/g, "") || null,
    }).eq("id", editModal.id);
    setSavingEdit(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Atleta atualizado!");
    setEditModal(null);
    loadData();
  }

  async function handleDeleteInscricao(insc: Inscricao) {
    if (!confirm(`Excluir inscrição de "${insc.atleta_nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(insc.id);
    const { error } = await supabase.from("inscricoes").delete().eq("id", insc.id);
    if (error) toast.error("Erro ao excluir: " + error.message);
    else { toast.success("Inscrição excluída"); setInscricoes((prev) => prev.filter((i) => i.id !== insc.id)); }
    setDeletingId(null);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">Perfil não encontrado</h2>
          <p className="text-gray-500 text-sm mb-6">
            Sua conta ainda não está vinculada a um evento. Contate o organizador.
          </p>
          <button onClick={handleSignOut} className="text-sm text-blue-600 hover:underline">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const eventoAberto = evento?.status === "aberto";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm">Arena</span>
            <span className="hidden sm:block text-gray-300 mx-2">·</span>
            <span className="hidden sm:block text-gray-500 text-sm truncate max-w-[200px]">
              {evento?.nome}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-gray-900">{profile?.nome}</p>
              <p className="text-xs text-gray-400">Professor</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Boas-vindas ──────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1d4ed8] rounded-2xl p-6 md:p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-blue-300 text-sm font-medium mb-1">Bem-vindo,</p>
              <h1 className="text-2xl md:text-3xl font-black leading-tight">
                {professor.nome}
              </h1>
              <p className="text-blue-200 text-sm mt-1">
                {(professor.associacoes as any)?.nome ?? ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center bg-white/10 border border-white/15 rounded-xl px-5 py-3">
                <p className="text-3xl font-black text-white">{inscricoes.length}</p>
                <p className="text-blue-300 text-xs mt-0.5">Atletas inscritos</p>
              </div>
              <button
                onClick={() => navigate("/professor/nova-inscricao")}
                disabled={!eventoAberto}
                className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Inscrever atleta
              </button>
            </div>
          </div>

          {/* Infos do evento */}
          {evento && (
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-400">Evento</p>
                  <p className="text-sm font-semibold text-white">{evento.nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-400">Data</p>
                  <p className="text-sm font-semibold text-white">
                    {formatDateLong(evento.data_inicio)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <div>
                  <p className="text-xs text-blue-400">Local</p>
                  <p className="text-sm font-semibold text-white">{evento.local}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Link de inscrição ─────────────────────────────────── */}
        {eventoAberto && professor && (
          <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Link de inscrição</p>
                <p className="text-gray-400 text-xs">Compartilhe com seus atletas para eles se inscreverem</p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-3">
              <p className="text-sm text-gray-600 font-mono flex-1 truncate">
                {window.location.origin}/inscrever/{professor.id}
              </p>
              <button
                onClick={copiarLink}
                title={copiado ? "Copiado!" : "Copiar link"}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${
                  copiado
                    ? "bg-green-100 text-green-700"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {copiado
                  ? <><Check className="w-3.5 h-3.5" /> Copiado</>
                  : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>

            <button
              onClick={compartilharLinkWhatsApp}
              className="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-xs transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Compartilhar via WhatsApp
            </button>
          </div>
        )}

        {/* ── Status do evento ─────────────────────────────────── */}
        {!eventoAberto && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-amber-800 text-sm font-medium">
              {evento?.status === "rascunho"
                ? "As inscrições ainda não foram abertas. Aguarde o organizador liberar."
                : "O período de inscrições foi encerrado."}
            </p>
          </div>
        )}

        {/* ── Guia do Professor ─────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => setGuiaAberto(!guiaAberto)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-900 text-sm">Guia do Professor</p>
                <p className="text-gray-400 text-xs">Como realizar as inscrições dos seus atletas</p>
              </div>
            </div>
            {guiaAberto
              ? <ChevronUp className="w-5 h-5 text-gray-400" />
              : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {guiaAberto && (
            <div className="px-5 pb-6 border-t border-gray-50">
              <div className="grid md:grid-cols-2 gap-4 mt-5">
                {[
                  {
                    step: "01",
                    icon: ClipboardList,
                    title: "Prepare a lista dos atletas",
                    desc: "Tenha em mãos: nome completo, data de nascimento, sexo, peso (kg) e graduação (faixa) de cada atleta da sua associação.",
                    color: "blue",
                  },
                  {
                    step: "02",
                    icon: PlusCircle,
                    title: "Inscreva um atleta por vez",
                    desc: "Clique em \"Inscrever atleta\" e preencha o formulário. Você pode adicionar quantos atletas precisar, um de cada vez.",
                    color: "indigo",
                  },
                  {
                    step: "03",
                    icon: CheckCircle,
                    title: "Confirme os dados antes de salvar",
                    desc: "Revise nome, data de nascimento e categoria antes de confirmar. Dados incorretos podem afetar o chaveamento do evento.",
                    color: "green",
                  },
                  {
                    step: "04",
                    icon: Users,
                    title: "Acompanhe suas inscrições",
                    desc: "Todos os atletas inscritos aparecem nesta tela. Você pode visualizar o QR Code de cada um para o check-in no dia do evento.",
                    color: "purple",
                  },
                ].map((item) => {
                  const colorMap: Record<string, string> = {
                    blue: "bg-blue-50 text-blue-600",
                    indigo: "bg-indigo-50 text-indigo-600",
                    green: "bg-green-50 text-green-600",
                    purple: "bg-purple-50 text-purple-600",
                  };
                  return (
                    <div key={item.step} className="flex gap-4 bg-gray-50 rounded-xl p-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[item.color]}`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-gray-300">PASSO {item.step}</span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm mb-1">{item.title}</p>
                        <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dicas importantes */}
              <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <p className="text-amber-900 font-bold text-sm">Dicas importantes</p>
                </div>
                <ul className="space-y-1.5">
                  {[
                    "Verifique o prazo de inscrição — após o encerramento não será possível incluir novos atletas.",
                    "O peso informado deve ser o peso de luta, não necessariamente o peso atual.",
                    "Cada atleta receberá um QR Code único para o check-in no dia do evento.",
                    "Em caso de dúvidas, entre em contato diretamente com o organizador do evento.",
                  ].map((dica) => (
                    <li key={dica} className="flex items-start gap-2 text-xs text-amber-800">
                      <span className="text-amber-400 font-bold mt-0.5">•</span>
                      {dica}
                    </li>
                  ))}
                </ul>
              </div>

              {eventoAberto && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => navigate("/professor/nova-inscricao")}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all"
                  >
                    Começar inscrições
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Lista de inscrições ───────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <h2 className="font-bold text-gray-900">Meus Atletas</h2>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {inscricoes.length}
              </span>
            </div>
            {eventoAberto && (
              <button
                onClick={() => navigate("/professor/nova-inscricao")}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Adicionar
              </button>
            )}
          </div>

          {inscricoes.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium text-sm">Nenhum atleta inscrito ainda</p>
              {eventoAberto && (
                <button
                  onClick={() => navigate("/professor/nova-inscricao")}
                  className="mt-4 text-blue-600 hover:underline text-sm font-semibold"
                >
                  Inscrever primeiro atleta →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {inscricoes.map((insc) => (
                <AtletaRow
                  key={insc.id}
                  insc={insc}
                  onVerQR={() => setQrModal(insc)}
                  onEdit={() => openEdit(insc)}
                  onDelete={() => handleDeleteInscricao(insc)}
                  deleting={deletingId === insc.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modal Editar Atleta ───────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-black text-gray-900 text-sm">Editar Atleta</h2>
                <p className="text-gray-400 text-xs mt-0.5">{editModal.atleta_nome}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="p-6 space-y-4">
              {(() => {
                const { register, formState: { errors }, watch } = editForm;
                const sexo = watch("atleta_sexo");
                const catsFiltradas = categorias.filter((c) => !c.sexo || c.sexo === "misto" || c.sexo === sexo);
                const inp = "w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all";
                const err = (msg?: string) => msg ? <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{msg}</p> : null;
                return (
                  <>
                    <ELabel>Nome completo *</ELabel>
                    <input {...register("atleta_nome")} className={inp} />
                    {err(errors.atleta_nome?.message)}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <ELabel>Data de nascimento *</ELabel>
                        <input {...register("atleta_data_nascimento")} type="date" max={new Date().toISOString().split("T")[0]} className={inp} />
                        {err(errors.atleta_data_nascimento?.message)}
                      </div>
                      <div>
                        <ELabel>Sexo *</ELabel>
                        <select {...register("atleta_sexo")} className={inp}>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                        </select>
                      </div>
                    </div>

                    <ELabel>Categoria *</ELabel>
                    <select {...register("categoria_id")} className={inp}>
                      <option value="">Selecione</option>
                      {catsFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                    {err(errors.categoria_id?.message)}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <ELabel>Graduação *</ELabel>
                        <select {...register("atleta_faixa")} className={inp}>
                          <option value="">Selecione</option>
                          {FAIXAS_JUDO.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        {err(errors.atleta_faixa?.message)}
                      </div>
                      <div>
                        <ELabel>Peso (kg) *</ELabel>
                        <input {...register("atleta_peso")} type="number" step="0.1" min="1" max="300" className={inp} />
                        {err(errors.atleta_peso?.message)}
                      </div>
                    </div>

                    <ELabel>CPF</ELabel>
                    <input {...register("atleta_cpf")} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} className={inp} />

                    <div className="grid grid-cols-2 gap-3">
                      <div><ELabel>E-mail</ELabel><input {...register("atleta_email")} type="email" className={inp} />{err(errors.atleta_email?.message)}</div>
                      <div><ELabel>Telefone</ELabel><input {...register("atleta_telefone")} type="tel" className={inp} /></div>
                    </div>

                    <ELabel>Nome do responsável</ELabel>
                    <input {...register("responsavel_nome")} className={inp} />

                    <ELabel>CPF do responsável</ELabel>
                    <input {...register("responsavel_cpf")} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} className={inp} />
                  </>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={savingEdit} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm transition-all">
                  {savingEdit ? <><Spinner className="w-4 h-4" /> Salvando...</> : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal QR Code ──────────────────────────────────────── */}
      {qrModal && (
        <QRModal
          insc={qrModal}
          eventoNome={evento?.nome ?? ""}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  );
}

// ── Modal QR Code ────────────────────────────────────────────────────────────

function QRModal({ insc, eventoNome, onClose }: { insc: Inscricao; eventoNome: string; onClose: () => void }) {
  const certUrl = `${window.location.origin}/certificado/${insc.check_in_token}`;
  const idade = calcularIdade(insc.atleta_data_nascimento);

  function compartilharWhatsApp() {
    const msg = encodeURIComponent(
      `🏆 *${eventoNome}*\n\n` +
      `Olá! Segue a credencial de check-in para *${insc.atleta_nome}*.\n\n` +
      `📋 *Dados:*\n` +
      `• Categoria: ${(insc.categorias as any)?.nome ?? "—"}\n` +
      `• Faixa: ${insc.atleta_faixa ?? "—"}\n` +
      `• Idade: ${idade} anos\n\n` +
      `📲 Apresente este QR Code no check-in do evento:\n${certUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function baixarQR() {
    const svg = document.getElementById("qr-svg-modal");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement("a");
      a.download = `qrcode-${insc.atleta_nome.replace(/\s+/g, "-")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-[#0f172a] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{insc.atleta_nome}</p>
            <p className="text-blue-300 text-xs mt-0.5">{eventoNome}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-inner">
            <QRCodeSVG
              id="qr-svg-modal"
              value={insc.check_in_token}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Dados do atleta */}
          <div className="w-full mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Idade</span>
              <span className="font-semibold text-gray-900">{idade} anos · {insc.atleta_sexo === "M" ? "Masculino" : "Feminino"}</span>
            </div>
            {(insc.categorias as any)?.nome && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Categoria</span>
                <span className="font-semibold text-blue-700">{(insc.categorias as any).nome}</span>
              </div>
            )}
            {insc.atleta_faixa && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Faixa</span>
                <span className="font-semibold text-gray-900">{insc.atleta_faixa}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <StatusBadge status={insc.status} />
            </div>
          </div>

          <p className="text-gray-300 text-xs mt-3 font-mono">{insc.check_in_token.slice(0, 8)}…</p>
        </div>

        {/* Ações */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-2">
          <button
            onClick={baixarQR}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold transition-all"
          >
            <Download className="w-4 h-4" /> Baixar QR
          </button>
          <button
            onClick={compartilharWhatsApp}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-all"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Linha do atleta ──────────────────────────────────────────────────────────

function AtletaRow({ insc, onVerQR, onEdit, onDelete, deleting }: {
  insc: Inscricao;
  onVerQR: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const idade = calcularIdade(insc.atleta_data_nascimento);
  const sexoLabel = insc.atleta_sexo === "M" ? "Masculino" : "Feminino";

  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600 font-black text-sm">
            {insc.atleta_nome.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{insc.atleta_nome}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-gray-400 text-xs">{idade} anos · {sexoLabel}</span>
            {insc.atleta_faixa && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                Faixa {insc.atleta_faixa}
              </span>
            )}
            {(insc.categorias as any)?.nome && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {(insc.categorias as any).nome}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <StatusBadge status={insc.status} />
        <button onClick={onVerQR} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Ver QR Code">
          <QrCode className="w-4 h-4" />
        </button>
        <button onClick={onEdit} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Editar">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} disabled={deleting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-40" title="Excluir">
          {deleting ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ELabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-gray-700 mb-1">{children}</label>;
}

function StatusBadge({ status }: { status: Inscricao["status"] }) {
  const map = {
    confirmado: "bg-green-100 text-green-700",
    pendente: "bg-amber-100 text-amber-700",
    cancelado: "bg-red-100 text-red-600",
  };
  const labels = { confirmado: "Confirmado", pendente: "Pendente", cancelado: "Cancelado" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}
