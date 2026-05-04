import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL e ANON_KEY são obrigatórios. Verifique o arquivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: { schema: "arena" },
});

// ── Types ────────────────────────────────────────────────────────────────────

export type Role = "admin" | "staff" | "professor";

export interface Profile {
  id: string;
  user_id: string;
  role: Role;
  nome: string;
  telefone?: string;
  created_at: string;
}

export interface Evento {
  id: string;
  nome: string;
  modalidade: string;
  descricao?: string;
  data_inicio: string;
  data_fim: string;
  data_inicio_inscricoes?: string;
  data_fim_inscricoes?: string;
  local: string;
  cidade?: string;
  uf?: string;
  status: "rascunho" | "aberto" | "encerrado";
  max_inscricoes?: number;
  logo_url?: string;
  encerrado_em?: string;
  encerrado_por?: string;
  created_at: string;
}

export interface Associacao {
  id: string;
  evento_id: string;
  nome: string;
  cidade?: string;
  uf?: string;
  ativo: boolean;
}

export interface Categoria {
  id: string;
  evento_id: string;
  nome: string;
  sexo?: "M" | "F" | "misto";
  idade_min?: number;
  idade_max?: number;
  peso_min?: number;
  peso_max?: number;
  faixas?: string[];
  ordem: number;
}

export interface Professor {
  id: string;
  profile_id?: string;
  associacao_id: string;
  evento_id: string;
  nome: string;
  cpf?: string;
  email: string;
  telefone?: string;
  graduacao?: string;
  status?: "pendente" | "ativo" | "rejeitado";
  associacao_nome?: string;
  invited_at?: string;
  invite_accepted_at?: string;
  associacoes?: Associacao;
  eventos?: Evento;
}

export interface Inscricao {
  id: string;
  evento_id: string;
  professor_id: string;
  associacao_id: string;
  categoria_id?: string;
  atleta_nome: string;
  atleta_cpf?: string;
  atleta_email?: string;
  atleta_telefone?: string;
  atleta_data_nascimento: string;
  atleta_sexo: "M" | "F";
  atleta_faixa?: string;
  atleta_peso?: number;
  responsavel_nome?: string;
  responsavel_cpf?: string;
  status: "pendente" | "confirmado" | "cancelado";
  check_in_token: string;
  sticker_printed: boolean;
  certificado_emitido: boolean;
  created_at: string;
  categorias?: Categoria;
  associacoes?: Associacao;
  professores?: Professor;
}
