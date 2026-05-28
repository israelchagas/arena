import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  CheckCircle, ArrowLeft, ArrowRight, User, Users, Send, Loader2,
  Trophy, Copy, Check, ChevronRight, MapPin, Phone, AtSign,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Participante", icon: User },
  { id: 2, title: "Responsável", icon: Users },
  { id: 3, title: "Esporte", icon: Trophy },
  { id: 4, title: "Confirmar", icon: Send },
];

const RELACAO_OPTIONS = [
  { value: "pai", label: "Pai" },
  { value: "mae", label: "Mãe" },
  { value: "avo", label: "Avô" },
  { value: "ava", label: "Avó" },
  { value: "tio", label: "Tio" },
  { value: "tia", label: "Tia" },
  { value: "tutor", label: "Tutor(a)" },
  { value: "outro", label: "Outro" },
];

function MrnLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="44" rx="8" fill="#1565C0" />
        <rect x="5" y="5" width="15" height="12" rx="1.5" fill="white" opacity="0.9"/>
        <rect x="12" y="5" width="1" height="12" fill="#1565C0" opacity="0.4"/>
        <rect x="6.5" y="8" width="4" height="1" fill="#1565C0" opacity="0.3"/>
        <rect x="6.5" y="10.5" width="4" height="1" fill="#1565C0" opacity="0.3"/>
        <circle cx="32" cy="11" r="7" fill="white" opacity="0.9"/>
        <circle cx="32" cy="11" r="7" fill="none" stroke="#1565C0" strokeWidth="0.5" opacity="0.2"/>
        <path d="M32 4 L32 18 M25.5 7.5 L38.5 14.5 M25.5 14.5 L38.5 7.5" stroke="#1565C0" strokeWidth="0.8" opacity="0.3"/>
        <rect x="5" y="26" width="15" height="10" rx="3.5" fill="white" opacity="0.9"/>
        <rect x="11" y="28.5" width="1" height="5" fill="#1565C0" opacity="0.3"/>
        <rect x="8.5" y="30.5" width="5" height="1" fill="#1565C0" opacity="0.3"/>
        <circle cx="18" cy="29.5" r="1" fill="#1565C0" opacity="0.3"/>
        <circle cx="16.5" cy="32" r="1" fill="#1565C0" opacity="0.3"/>
        <rect x="24" y="26" width="15" height="10" rx="2" fill="white" opacity="0.9"/>
        <path d="M31.5 26 Q31.5 23 34 23 Q36.5 23 36.5 26" fill="white" opacity="0.9"/>
        <path d="M39 30 Q42 30 42 32.5 Q42 35 39 35" fill="white" opacity="0.9"/>
      </svg>
      <div>
        <div className="font-black text-blue-800 text-base leading-none tracking-wide">MRN</div>
        <div className="text-blue-600 text-xs font-medium tracking-wider">Educacional</div>
      </div>
    </div>
  );
}

function calcularIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 ? idade : null;
}

export default function CadastroProfessor() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [numeroProtocolo, setNumeroProtocolo] = useState("");
  const [nomeParticipante, setNomeParticipante] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    nomeCompleto: "",
    dataNascimento: "",
    sexo: "" as "masculino" | "feminino" | "outro" | "",
    cpfCrianca: "",
    rgCrianca: "",
    rgOrgaoExpedidor: "",
    enderecoCompleto: "",

    responsavelNome: "",
    responsavelCpf: "",
    responsavelRg: "",
    responsavelTelefone: "",
    responsavelEmail: "",
    responsavelRelacao: "mae" as "pai" | "mae" | "avo" | "ava" | "tio" | "tia" | "tutor" | "outro",

    praticaJudo: null as boolean | null,
    faixa: "",
    instituicao: "",

    autorizacaoAceita: false,
  });

  const update = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));
  const idade = calcularIdade(form.dataNascimento);

  const canNext = () => {
    if (step === 1) return !!(form.nomeCompleto.trim() && form.dataNascimento && form.sexo && form.enderecoCompleto.trim());
    if (step === 2) return !!(form.responsavelNome.trim() && form.responsavelCpf.trim() && form.responsavelRg.trim() && form.responsavelTelefone.trim() && form.responsavelRelacao);
    if (step === 3) return form.praticaJudo !== null && form.autorizacaoAceita;
    return true;
  };

  const handleSubmit = async () => {
    setEnviando(true);
    const sexoMap: Record<string, string> = { masculino: "M", feminino: "F", outro: "outro" };
    const numero = `${new Date().getFullYear()}${Math.floor(10000 + Math.random() * 90000)}`;

    const { error } = await supabase.from("inscricoes").insert({
      atleta_nome: form.nomeCompleto.trim(),
      atleta_data_nascimento: form.dataNascimento,
      atleta_sexo: sexoMap[form.sexo] ?? "outro",
      atleta_cpf: form.cpfCrianca || null,
      atleta_rg: form.rgCrianca || null,
      atleta_rg_orgao: form.rgOrgaoExpedidor || null,
      atleta_faixa: form.faixa || null,
      atleta_endereco: form.enderecoCompleto || null,
      responsavel_nome: form.responsavelNome,
      responsavel_cpf: form.responsavelCpf || null,
      responsavel_rg: form.responsavelRg || null,
      responsavel_tel: form.responsavelTelefone,
      responsavel_email: form.responsavelEmail || null,
      responsavel_relacao: form.responsavelRelacao,
      pratica_judo: form.praticaJudo,
      instituicao_judo: form.instituicao || null,
      autorizacao_aceita: form.autorizacaoAceita,
      numero_inscricao: numero,
      status: "pendente",
    });

    setEnviando(false);

    if (error) {
      toast.error(`Erro ao enviar inscrição: ${error.message}`);
      return;
    }

    setNumeroProtocolo(numero);
    setNomeParticipante(form.nomeCompleto);
    setStep(5);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Envia email em background (não bloqueia a tela de sucesso)
    fetch("/.netlify/functions/send-inscricao-festival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        atleta_nome: form.nomeCompleto.trim(),
        atleta_data_nascimento: form.dataNascimento,
        atleta_sexo: sexoMap[form.sexo] ?? "outro",
        atleta_cpf: form.cpfCrianca || null,
        atleta_rg: form.rgCrianca || null,
        atleta_rg_orgao: form.rgOrgaoExpedidor || null,
        atleta_faixa: form.faixa || null,
        atleta_endereco: form.enderecoCompleto || null,
        responsavel_nome: form.responsavelNome,
        responsavel_cpf: form.responsavelCpf || null,
        responsavel_rg: form.responsavelRg || null,
        responsavel_tel: form.responsavelTelefone,
        responsavel_email: form.responsavelEmail || null,
        responsavel_relacao: form.responsavelRelacao,
        pratica_judo: form.praticaJudo,
        instituicao_judo: form.instituicao || null,
        autorizacao_aceita: form.autorizacaoAceita,
        numero_inscricao: numero,
      }),
    }).catch(() => {/* ignora erro silenciosamente */});
  };

  const copiarNumero = () => {
    navigator.clipboard.writeText(numeroProtocolo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <header className="bg-white border-b border-gray-100 px-4 py-4 shadow-sm">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <MrnLogo />
            <div className="ml-2 border-l border-gray-200 pl-3">
              <p className="text-xs text-gray-400">Festival de Judô – Cultura de Campeões</p>
              <p className="text-xs font-semibold text-gray-600">Fomento: 986080/2025</p>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="overflow-hidden rounded-2xl border-0 shadow-xl shadow-green-100/60">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Inscrição enviada!</h2>
              <p className="text-green-100 text-sm">
                Solicitação recebida com sucesso para <strong className="text-white">{nomeParticipante}</strong>
              </p>
            </div>

            <div className="px-6 py-5 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-3">
                Número de Protocolo
              </p>
              <div className="flex items-center justify-center gap-3 bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-4">
                <span className="text-3xl font-bold text-blue-700 tracking-wider font-mono">
                  {numeroProtocolo}
                </span>
                <button
                  onClick={copiarNumero}
                  className="p-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-500"
                  title="Copiar número"
                >
                  {copiado ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">
                Guarde este número para acompanhar o status da inscrição
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-blue-600" />
              O que acontece agora?
            </h3>
            <div className="space-y-3">
              {[
                { n: "1", t: "Confirmação por WhatsApp", d: "Entraremos em contato pelo número informado para confirmar sua inscrição.", c: "bg-green-100 text-green-700" },
                { n: "2", t: "Data do evento", d: "13 de junho de 2026 · 8h às 18h — IFB Campus Estrutural, Brasília/DF.", c: "bg-blue-100 text-blue-700" },
                { n: "3", t: "No dia do evento", d: "Leve documento de identidade da criança e do responsável. Entrada gratuita!", c: "bg-orange-100 text-orange-700" },
              ].map(p => (
                <div key={p.n} className="flex gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${p.c}`}>
                    {p.n}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{p.t}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-sm bg-gradient-to-br from-blue-900 to-blue-800 text-white">
            <div className="p-5">
              <h3 className="text-sm font-bold text-blue-200 uppercase tracking-wide mb-4">
                Dúvidas? Fale conosco
              </h3>
              <div className="space-y-3">
                <a href="https://wa.me/5561999999999" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3">
                  <Phone className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-200">WhatsApp</p>
                    <p className="text-sm font-semibold">(61) 99999-9999</p>
                  </div>
                </a>
                <a href="https://instagram.com/culturadecampeoes" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3">
                  <AtSign className="w-5 h-5 text-pink-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-200">Instagram</p>
                    <p className="text-sm font-semibold">@culturadecampeoes</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <button
            className="w-full bg-blue-700 hover:bg-blue-800 text-white h-12 text-base font-semibold rounded-lg transition-colors"
            onClick={() => navigate("/login")}
          >
            Voltar para o início
          </button>

          <p className="text-center text-xs text-gray-400 pb-4">
            SCLRN 705, bloco E, loja 8, Asa Norte, Brasília – DF · CNPJ: 34.436.143/0001-62
          </p>
        </div>
      </div>
    );
  }

  // ── Formulário (steps 1–4) ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <header className="bg-white border-b border-gray-100 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/login")} className="text-gray-400 hover:text-gray-600 p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <MrnLogo />
          <div className="ml-1 border-l border-gray-200 pl-3">
            <p className="text-xs font-semibold text-blue-900">Festival de Judô – Cultura de Campeões</p>
            <p className="text-xs text-gray-400">Fomento: 986080/2025 · Entrada gratuita</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Steps */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.id ? "bg-green-500 text-white" :
                  step === s.id ? "bg-blue-700 text-white shadow-md shadow-blue-200" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {step > s.id ? "✓" : s.id}
                </div>
                <span className={`text-xs mt-1 hidden sm:block font-medium ${step === s.id ? "text-blue-700" : "text-gray-400"}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 ${step > s.id ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-0.5">1. Dados do Participante</h2>
              <p className="text-gray-400 text-sm mb-6">Preencha os dados da criança que irá participar do festival.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nome Completo da Criança *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.nomeCompleto}
                    onChange={e => update("nomeCompleto", e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Data de Nascimento *</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.dataNascimento}
                      onChange={e => update("dataNascimento", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Idade</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-default"
                      value={idade !== null ? `${idade} anos` : ""}
                      readOnly
                      placeholder="Calculada automaticamente"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">Sexo *</label>
                  <div className="flex gap-4">
                    {[
                      { value: "masculino", label: "Masculino" },
                      { value: "feminino", label: "Feminino" },
                      { value: "outro", label: "Prefiro não informar" },
                    ].map(op => (
                      <label key={op.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sexo"
                          value={op.value}
                          checked={form.sexo === op.value}
                          onChange={() => update("sexo", op.value)}
                          className="accent-blue-700"
                        />
                        <span className="text-sm text-gray-700">{op.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">CPF da Criança (se possuir)</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.cpfCrianca}
                      onChange={e => update("cpfCrianca", e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">RG da Criança (se possuir)</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.rgCrianca}
                      onChange={e => update("rgCrianca", e.target.value)}
                      placeholder="Número do RG"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Órgão Expedidor do RG</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.rgOrgaoExpedidor}
                    onChange={e => update("rgOrgaoExpedidor", e.target.value)}
                    placeholder="Ex: SSP/DF"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Endereço Completo *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.enderecoCompleto}
                    onChange={e => update("enderecoCompleto", e.target.value)}
                    placeholder="Rua, número, complemento, bairro, cidade – UF"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-0.5">2. Dados do Responsável Legal</h2>
              <p className="text-gray-400 text-sm mb-6">Informações de quem autoriza a participação da criança.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Nome Completo do Responsável *</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.responsavelNome}
                    onChange={e => update("responsavelNome", e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">CPF *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.responsavelCpf}
                      onChange={e => update("responsavelCpf", e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">RG *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.responsavelRg}
                      onChange={e => update("responsavelRg", e.target.value)}
                      placeholder="Número do RG"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Telefone / WhatsApp *</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.responsavelTelefone}
                      onChange={e => update("responsavelTelefone", e.target.value)}
                      placeholder="(61) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">E-mail</label>
                    <input
                      type="email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.responsavelEmail}
                      onChange={e => update("responsavelEmail", e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Grau de Parentesco *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={form.responsavelRelacao}
                    onChange={e => update("responsavelRelacao", e.target.value)}
                  >
                    {RELACAO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-blue-900 mb-0.5">3. Informações Esportivas</h2>
                <p className="text-gray-400 text-sm mb-4">Experiência da criança com o judô.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-2">A criança já pratica judô? *</label>
                    <div className="flex gap-6">
                      {[{ value: false, label: "Não" }, { value: true, label: "Sim" }].map(op => (
                        <label key={String(op.value)} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="praticaJudo"
                            checked={form.praticaJudo === op.value}
                            onChange={() => update("praticaJudo", op.value)}
                            className="accent-blue-700"
                          />
                          <span className="text-sm text-gray-700">{op.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {form.praticaJudo && (
                    <div className="grid grid-cols-2 gap-4 pl-1">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Faixa (se houver)</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={form.faixa}
                          onChange={e => update("faixa", e.target.value)}
                          placeholder="Ex: Branca, Amarela..."
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">Instituição / Academia</label>
                        <input
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={form.instituicao}
                          onChange={e => update("instituicao", e.target.value)}
                          placeholder="Nome da academia"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h2 className="text-xl font-bold text-blue-900 mb-3">4. Autorização</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                  <p>
                    Eu, <strong>{form.responsavelNome || "___________________________"}</strong>, responsável legal pelo(a) participante acima identificado(a),{" "}
                    <strong>AUTORIZO</strong> sua participação no evento <strong>Festival de Judô – Cultura de Campeões</strong>, a ser realizado no dia <strong>13/06/2026</strong>, em Brasília/DF.
                  </p>
                  <p className="mt-3">
                    Declaro estar ciente das atividades desenvolvidas durante o evento e autorizo o uso gratuito da imagem do(a) participante em registros fotográficos e audiovisuais exclusivamente para fins institucionais, educativos e de prestação de contas do projeto.
                  </p>
                  <p className="mt-3">
                    Declaro, ainda, que as informações prestadas nesta ficha são verdadeiras.
                  </p>
                </div>

                <label className="flex items-start gap-3 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autorizacaoAceita}
                    onChange={e => update("autorizacaoAceita", e.target.checked)}
                    className="accent-blue-700 mt-0.5 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700">
                    Li e concordo com os termos acima. Esta marcação equivale à minha assinatura digital.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-1">Confirme os dados</h2>
              <p className="text-gray-400 text-sm mb-6">Verifique as informações antes de enviar a inscrição.</p>
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Participante</p>
                  <p className="font-semibold text-blue-900">{form.nomeCompleto}</p>
                  <p className="text-sm text-gray-600">Nascimento: {form.dataNascimento} {idade !== null ? `(${idade} anos)` : ""}</p>
                  <p className="text-sm text-gray-600">Sexo: {({ masculino: "Masculino", feminino: "Feminino", outro: "Prefiro não informar" } as Record<string, string>)[form.sexo] ?? ""}</p>
                  {form.enderecoCompleto && <p className="text-sm text-gray-600 mt-1">{form.enderecoCompleto}</p>}
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Responsável Legal</p>
                  <p className="font-semibold text-gray-800">{form.responsavelNome}</p>
                  <p className="text-sm text-gray-600">{form.responsavelTelefone}</p>
                  {form.responsavelEmail && <p className="text-sm text-gray-600">{form.responsavelEmail}</p>}
                  <p className="text-sm text-gray-500 mt-1">
                    {RELACAO_OPTIONS.find(r => r.value === form.responsavelRelacao)?.label}
                  </p>
                </div>

                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">Informações Esportivas</p>
                  <p className="text-sm text-gray-700">
                    Pratica judô: <strong>{form.praticaJudo ? "Sim" : "Não"}</strong>
                    {form.praticaJudo && form.faixa && ` · Faixa: ${form.faixa}`}
                    {form.praticaJudo && form.instituicao && ` · ${form.instituicao}`}
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <CheckCircle className="w-4 h-4" /> Autorização aceita digitalmente
                  </p>
                  <p className="text-xs text-green-600">
                    Festival de Judô – Cultura de Campeões · 13/06/2026 · Fomento 986080/2025
                  </p>
                </div>

                <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>IFB Campus Estrutural · Estrutural – Brasília/DF · Evento gratuito</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate("/login")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? "Cancelar" : "Anterior"}
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={enviando}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors min-w-[160px] justify-center"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Inscrição
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          SCLRN 705, bloco E, loja 8, Asa Norte, Brasília – DF · CNPJ: 34.436.143/0001-62
          <br />associacaomrneducacional@gmail.com
        </p>
      </div>
    </div>
  );
}
