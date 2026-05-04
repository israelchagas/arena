export interface TemplateElement {
  id: string;
  type: "text";
  text: string;
  x_mm: number;
  y_mm: number;
  font_size_pt: number;
  font_family: string;
  font_weight?: "normal" | "bold";
  font_style?: "normal" | "italic";
  alignment?: "left" | "center" | "right";
  color: string;
  line_height?: number;
}

export interface CertTemplate {
  paper: { size: string; orientation: string; width_mm: number; height_mm: number };
  background: { color: string; border_color?: string; border_width_mm?: number };
  elements: TemplateElement[];
}

export const VARIABLES = [
  { key: "{{atleta_nome}}",  label: "Nome do atleta" },
  { key: "{{evento_nome}}",  label: "Nome do evento" },
  { key: "{{data_evento}}",  label: "Data do evento" },
  { key: "{{local}}",        label: "Local" },
  { key: "{{cidade}}",       label: "Cidade/UF" },
  { key: "{{categoria}}",    label: "Categoria" },
  { key: "{{associacao}}",   label: "Associação" },
  { key: "{{faixa}}",        label: "Faixa" },
  { key: "{{modalidade}}",   label: "Modalidade" },
];

export const DEFAULT_TEMPLATE: CertTemplate = {
  paper: { size: "A3", orientation: "landscape", width_mm: 420, height_mm: 297 },
  background: { color: "#ffffff", border_color: "#2c3e50", border_width_mm: 6 },
  elements: [
    { id: "1", type: "text", text: "CERTIFICADO DE PARTICIPAÇÃO", x_mm: 210, y_mm: 38, font_size_pt: 28, font_family: "Arial, sans-serif", font_weight: "bold", alignment: "center", color: "#2c3e50" },
    { id: "2", type: "text", text: "{{modalidade}} · {{evento_nome}}", x_mm: 210, y_mm: 58, font_size_pt: 13, font_family: "Arial, sans-serif", alignment: "center", color: "#7f8c8d" },
    { id: "3", type: "text", text: "Este certificado é concedido a", x_mm: 210, y_mm: 90, font_size_pt: 14, font_family: "Arial, sans-serif", alignment: "center", color: "#000000" },
    { id: "4", type: "text", text: "{{atleta_nome}}", x_mm: 210, y_mm: 128, font_size_pt: 34, font_family: "Georgia, serif", font_weight: "bold", alignment: "center", color: "#1a5276" },
    { id: "5", type: "text", text: "{{associacao}}", x_mm: 210, y_mm: 155, font_size_pt: 14, font_family: "Arial, sans-serif", font_style: "italic", alignment: "center", color: "#555555" },
    { id: "6", type: "text", text: "por sua participação e dedicação demonstradas em", x_mm: 210, y_mm: 176, font_size_pt: 13, font_family: "Arial, sans-serif", alignment: "center", color: "#000000" },
    { id: "7", type: "text", text: "{{data_evento}} · {{local}}, {{cidade}}", x_mm: 210, y_mm: 194, font_size_pt: 12, font_family: "Arial, sans-serif", alignment: "center", color: "#666666" },
    { id: "8", type: "text", text: "Categoria: {{categoria}}   ·   Faixa {{faixa}}", x_mm: 210, y_mm: 212, font_size_pt: 12, font_family: "Arial, sans-serif", alignment: "center", color: "#444444" },
    { id: "9", type: "text", text: "________________________________", x_mm: 105, y_mm: 260, font_size_pt: 12, font_family: "Arial, sans-serif", alignment: "center", color: "#2c3e50" },
    { id: "10", type: "text", text: "Organizador do Evento", x_mm: 105, y_mm: 272, font_size_pt: 11, font_family: "Arial, sans-serif", font_weight: "bold", alignment: "center", color: "#7f8c8d" },
    { id: "11", type: "text", text: "________________________________", x_mm: 315, y_mm: 260, font_size_pt: 12, font_family: "Arial, sans-serif", alignment: "center", color: "#2c3e50" },
    { id: "12", type: "text", text: "Diretor Técnico", x_mm: 315, y_mm: 272, font_size_pt: 11, font_family: "Arial, sans-serif", font_weight: "bold", alignment: "center", color: "#7f8c8d" },
  ],
};

export function applyVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(k, v), text);
}

export function newElement(): TemplateElement {
  return {
    id: crypto.randomUUID(),
    type: "text",
    text: "Novo texto",
    x_mm: 210,
    y_mm: 148,
    font_size_pt: 14,
    font_family: "Arial, sans-serif",
    font_weight: "normal",
    alignment: "center",
    color: "#000000",
    line_height: 1.4,
  };
}
