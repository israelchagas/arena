import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import QRCode from "qrcode";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body, status = 200) {
  return {
    statusCode: status,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function formatDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function emailHtml(insc, qrBase64) {
  const evento   = insc.eventos    ?? {};
  const prof     = insc.professores ?? {};
  const cat      = insc.categorias  ?? {};
  const assoc    = insc.associacoes ?? {};

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:32px 40px;text-align:center;">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;">🏆 Arena</div>
      <div style="font-size:13px;color:#93c5fd;margin-top:4px;">Gestão de Eventos Esportivos</div>
    </td>
  </tr>

  <!-- Confirmação -->
  <tr>
    <td style="padding:32px 40px 0;">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;text-align:center;margin-bottom:24px;">
        <p style="font-size:18px;font-weight:800;color:#15803d;margin:0;">✅ Inscrição Confirmada!</p>
        <p style="font-size:13px;color:#16a34a;margin:6px 0 0;">${insc.atleta_nome}</p>
      </div>

      <!-- Evento -->
      <div style="margin-bottom:24px;">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 10px;">Evento</p>
        <p style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 6px;">${evento.nome ?? ""}</p>
        <p style="font-size:13px;color:#64748b;margin:0;">
          📅 ${evento.data_inicio ? formatDate(evento.data_inicio) : ""}
        </p>
        <p style="font-size:13px;color:#64748b;margin:4px 0 0;">
          📍 ${evento.local ?? ""}${evento.cidade ? `, ${evento.cidade}` : ""}
        </p>
      </div>

      <!-- Dados da inscrição -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Dados da Inscrição</p>
        ${cat.nome ? `<p style="font-size:13px;color:#374151;margin:0 0 6px;"><strong>Categoria:</strong> ${cat.nome}</p>` : ""}
        ${insc.atleta_faixa ? `<p style="font-size:13px;color:#374151;margin:0 0 6px;"><strong>Faixa:</strong> ${insc.atleta_faixa}</p>` : ""}
        ${insc.atleta_peso ? `<p style="font-size:13px;color:#374151;margin:0 0 6px;"><strong>Peso:</strong> ${insc.atleta_peso} kg</p>` : ""}
        ${prof.nome ? `<p style="font-size:13px;color:#374151;margin:0 0 6px;"><strong>Professor:</strong> ${prof.nome}</p>` : ""}
        ${assoc.nome ? `<p style="font-size:13px;color:#374151;margin:0;"><strong>Associação:</strong> ${assoc.nome}</p>` : ""}
      </div>
    </td>
  </tr>

  <!-- QR Code -->
  <tr>
    <td style="padding:0 40px 24px;text-align:center;">
      <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px;">Seu QR Code para Check-in</p>
      <div style="display:inline-block;background:#fff;border:3px solid #0f172a;border-radius:16px;padding:16px;">
        <img src="data:image/png;base64,${qrBase64}" width="200" height="200" alt="QR Code Check-in" style="display:block;" />
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:12px 0 0;">Apresente este QR Code na entrada do evento</p>
    </td>
  </tr>

  <!-- Instruções -->
  <tr>
    <td style="padding:0 40px 32px;">
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:18px 20px;">
        <p style="font-size:13px;font-weight:700;color:#1d4ed8;margin:0 0 12px;">📋 Instruções para o dia do evento</p>
        ${[
          "Chegue com <strong>pelo menos 1 hora de antecedência</strong> ao horário da sua luta",
          "Tenha o QR Code disponível no celular ou impresso",
          "Traga documento com foto (RG, CPF ou Certidão de Nascimento)",
          "Apresente-se ao professor para confirmar presença",
          "Vista o judogi (kimono) limpo e em bom estado",
          "Mantenha-se hidratado e faça um aquecimento adequado",
        ].map(item => `
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
            <span style="color:#3b82f6;font-weight:700;flex-shrink:0;">•</span>
            <p style="font-size:13px;color:#1e40af;margin:0;line-height:1.5;">${item}</p>
          </div>
        `).join("")}
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6;">
        Arena · Gestão de Eventos Esportivos<br>
        Este e-mail foi gerado automaticamente. Em caso de dúvidas, contate seu professor.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "ok" };
  if (event.httpMethod !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey   = process.env.RESEND_API_KEY ?? "";
    if (!supabaseUrl || !serviceKey) return respond({ error: "Env não configurado" }, 500);

    const { inscricao_id } = JSON.parse(event.body ?? "{}");
    if (!inscricao_id) return respond({ error: "inscricao_id obrigatório" }, 400);

    const arena = createClient(supabaseUrl, serviceKey, {
      db: { schema: "arena" },
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws },
      global: { fetch },
    });

    const { data: insc, error } = await arena
      .from("inscricoes")
      .select("*, eventos(*), professores(*), categorias(*), associacoes(*)")
      .eq("id", inscricao_id)
      .single();

    if (error || !insc) return respond({ error: "Inscrição não encontrada" }, 404);
    if (!insc.atleta_email) return respond({ skipped: true, reason: "sem e-mail" });

    const qrBase64 = await QRCode.toDataURL(insc.check_in_token, {
      width: 300,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((d) => d.split(",")[1]);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Arena <matricula@culturadecampeoes.com.br>",
        to: [insc.atleta_email],
        subject: `🏆 Inscrição confirmada — ${insc.eventos?.nome ?? "Arena"}`,
        html: emailHtml(insc, qrBase64),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[send-checkin-email] Resend error:", body);
      return respond({ error: "Falha ao enviar e-mail" }, 500);
    }

    return respond({ success: true });
  } catch (err) {
    console.error("[send-checkin-email] Unhandled:", err);
    return respond({ error: err?.message ?? "Erro interno" }, 500);
  }
};
