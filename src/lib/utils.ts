import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return d.toLocaleDateString("pt-BR");
}

export function formatDateLong(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nasc = new Date(dataNascimento + "T00:00:00");
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export const FAIXAS_JUDO = [
  "Branca",
  "Cinza",
  "Azul",
  "Amarela",
  "Laranja",
  "Verde",
  "Roxa",
  "Marrom",
  "Preta",
];

export const FAIXAS_CORES: Record<string, string> = {
  Branca: "#ffffff",
  Cinza: "#9ca3af",
  Azul: "#3b82f6",
  Amarela: "#fbbf24",
  Laranja: "#f97316",
  Verde: "#22c55e",
  Roxa: "#a855f7",
  Marrom: "#92400e",
  Preta: "#111827",
};
