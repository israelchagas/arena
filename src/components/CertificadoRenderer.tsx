import { CertTemplate, applyVariables } from "@/lib/certificadoTemplate";

const PX_PER_MM = 3.7795;

interface Props {
  template: CertTemplate;
  variables?: Record<string, string>;
  scale?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  logoUrl?: string;
}

export function CertificadoRenderer({ template, variables = {}, scale = 1, selectedId, onSelect, logoUrl }: Props) {
  const { width_mm, height_mm } = template.paper;
  const { color: bgColor, border_color, border_width_mm = 0 } = template.background;

  const W = width_mm * PX_PER_MM;
  const H = height_mm * PX_PER_MM;

  return (
    <div
      style={{
        width: W,
        height: H,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        position: "relative",
        background: bgColor,
        boxSizing: "border-box",
        border: border_color ? `${border_width_mm * PX_PER_MM * scale}px solid ${border_color}` : undefined,
        boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo do evento */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            position: "absolute",
            left: 18 * PX_PER_MM,
            top: 18 * PX_PER_MM,
            width: 30 * PX_PER_MM,
            height: 30 * PX_PER_MM,
            objectFit: "contain",
          }}
        />
      )}

      {template.elements.map((el) => {
        const text = applyVariables(el.text, variables);
        const isSelected = selectedId === el.id;
        const lines = text.split("\n");

        const style: React.CSSProperties = {
          position: "absolute",
          left: el.alignment === "center" ? 0 : el.x_mm * PX_PER_MM,
          top: el.y_mm * PX_PER_MM,
          width: el.alignment === "center" ? "100%" : undefined,
          textAlign: el.alignment ?? "left",
          fontSize: el.font_size_pt * 1.333,
          fontFamily: el.font_family,
          fontWeight: el.font_weight ?? "normal",
          fontStyle: el.font_style ?? "normal",
          color: el.color,
          lineHeight: el.line_height ?? 1.2,
          whiteSpace: "pre-wrap",
          cursor: onSelect ? "pointer" : "default",
          outline: isSelected ? "2px dashed #3b82f6" : undefined,
          outlineOffset: 4,
          padding: "0 2px",
          userSelect: "none",
          transformOrigin: el.alignment === "left" ? "left top" : "center top",
        };

        if (el.alignment !== "center") {
          style.left = el.x_mm * PX_PER_MM;
          style.transform = "none";
        }

        return (
          <div
            key={el.id}
            style={style}
            onClick={() => onSelect?.(el.id)}
          >
            {lines.map((line, i) => (
              <div key={i}>{line || " "}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
