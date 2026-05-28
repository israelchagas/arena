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
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function row(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="font-size:12px;color:#64748b;padding:5px 0 5px 0;width:45%;vertical-align:top;">${label}</td>
      <td style="font-size:13px;color:#0f172a;font-weight:600;padding:5px 0 5px 12px;vertical-align:top;">${value}</td>
    </tr>`;
}

function section(title, color, rows) {
  return `
    <tr>
      <td style="padding:0 40px 20px;">
        <div style="border-left:4px solid ${color};padding-left:14px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 2px;">${title}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows}
        </table>
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0 0;" />
      </td>
    </tr>`;
}

function emailHtml(d) {
  const sexoLabel = { M: "Masculino", F: "Feminino", outro: "Prefiro não informar" };
  const relacaoLabel = {
    pai: "Pai", mae: "Mãe", avo: "Avô", ava: "Avó",
    tio: "Tio", tia: "Tia", tutor: "Tutor(a)", outro: "Outro",
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#1565C0 0%,#0d47a1 100%);padding:28px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">MRN Educacional</div>
            <div style="font-size:13px;color:#90caf9;margin-top:2px;">Festival de Judô – Cultura de Campeões</div>
            <div style="font-size:11px;color:#bbdefb;margin-top:2px;">Fomento: 986080/2025</div>
          </td>
          <td align="right" style="vertical-align:top;">
            <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;text-align:center;">
              <div style="font-size:10px;color:#90caf9;font-weight:600;letter-spacing:1px;">PROTOCOLO</div>
              <div style="font-size:18px;font-weight:900;color:#fff;font-family:monospace;letter-spacing:2px;">${d.numero_inscricao}</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Confirmação -->
  <tr>
    <td style="padding:28px 40px 20px;">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:14px 20px;text-align:center;margin-bottom:8px;">
        <p style="font-size:16px;font-weight:800;color:#15803d;margin:0;">✅ Inscrição Recebida com Sucesso!</p>
        <p style="font-size:13px;color:#16a34a;margin:4px 0 0;">
          <strong>${d.atleta_nome}</strong> está inscrito(a) no festival.<br>
          Guarde o número de protocolo: <strong>${d.numero_inscricao}</strong>
        </p>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:8px 0 0;">
        📅 13 de junho de 2026 · 8h às 18h &nbsp;|&nbsp; 📍 IFB Campus Estrutural, Brasília/DF
      </p>
    </td>
  </tr>

  <!-- Dados do Participante -->
  ${section("1. Dados do Participante", "#1565C0",
    row("Nome completo", d.atleta_nome) +
    row("Data de nascimento", formatDate(d.atleta_data_nascimento)) +
    row("Sexo", sexoLabel[d.atleta_sexo] ?? d.atleta_sexo) +
    row("CPF", d.atleta_cpf) +
    row("RG", d.atleta_rg ? `${d.atleta_rg}${d.atleta_rg_orgao ? ` / ${d.atleta_rg_orgao}` : ""}` : "") +
    row("Endereço", d.atleta_endereco)
  )}

  <!-- Dados do Responsável -->
  ${section("2. Dados do Responsável Legal", "#7c3aed",
    row("Nome completo", d.responsavel_nome) +
    row("Parentesco", relacaoLabel[d.responsavel_relacao] ?? d.responsavel_relacao) +
    row("CPF", d.responsavel_cpf) +
    row("RG", d.responsavel_rg) +
    row("Telefone / WhatsApp", d.responsavel_tel) +
    row("E-mail", d.responsavel_email)
  )}

  <!-- Informações Esportivas -->
  ${section("3. Informações Esportivas", "#d97706",
    row("Pratica judô", d.pratica_judo ? "Sim" : "Não") +
    (d.pratica_judo ? row("Faixa", d.atleta_faixa || "—") + row("Academia / Instituição", d.instituicao_judo || "—") : "")
  )}

  <!-- Autorização -->
  <tr>
    <td style="padding:0 40px 24px;">
      <div style="border-left:4px solid #16a34a;padding-left:14px;margin-bottom:12px;">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 2px;">4. Autorização</p>
      </div>
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px 18px;">
        <p style="font-size:13px;color:#166534;margin:0;line-height:1.6;">
          ✅ <strong>${d.responsavel_nome}</strong> autorizou digitalmente a participação de
          <strong>${d.atleta_nome}</strong> no evento <strong>Festival de Judô – Cultura de Campeões</strong>
          em 13/06/2026, em Brasília/DF, e o uso de imagem para fins institucionais e de prestação de contas.
        </p>
      </div>
    </td>
  </tr>

  <!-- Próximos passos -->
  <tr>
    <td style="padding:0 40px 28px;">
      <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:18px 20px;">
        <p style="font-size:13px;font-weight:700;color:#1d4ed8;margin:0 0 10px;">📋 O que acontece agora?</p>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <span style="font-weight:700;color:#3b82f6;">1.</span>
          <p style="font-size:13px;color:#1e40af;margin:0;">Entraremos em contato pelo WhatsApp informado para confirmar.</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <span style="font-weight:700;color:#3b82f6;">2.</span>
          <p style="font-size:13px;color:#1e40af;margin:0;">No dia do evento: leve documento de identidade da criança e do responsável.</p>
        </div>
        <div style="display:flex;gap:8px;">
          <span style="font-weight:700;color:#3b82f6;">3.</span>
          <p style="font-size:13px;color:#1e40af;margin:0;">Evento gratuito — entrada franca!</p>
        </div>
      </div>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6;">
        MRN Educacional · SCLRN 705, bloco E, loja 8, Asa Norte, Brasília – DF<br>
        CNPJ: 34.436.143/0001-62 · associacaomrneducacional@gmail.com
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
    const resendKey = process.env.RESEND_API_KEY ?? "";
    if (!resendKey) return respond({ error: "RESEND_API_KEY não configurado" }, 500);

    const data = JSON.parse(event.body ?? "{}");
    if (!data.atleta_nome || !data.numero_inscricao) {
      return respond({ error: "Dados incompletos" }, 400);
    }

    const to = [];
    if (data.responsavel_email) to.push(data.responsavel_email);

    // Sempre envia cópia para a organização
    const bcc = ["associacaomrneducacional@gmail.com"];

    if (to.length === 0) {
      // Se não tem email do responsável, envia só para a organização
      to.push("associacaomrneducacional@gmail.com");
      bcc.length = 0;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MRN Educacional <matricula@culturadecampeoes.com.br>",
        to,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject: `✅ Inscrição recebida – Festival de Judô · Protocolo ${data.numero_inscricao}`,
        html: emailHtml(data),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[send-inscricao-festival] Resend error:", body);
      return respond({ error: "Falha ao enviar e-mail" }, 500);
    }

    return respond({ success: true });
  } catch (err) {
    console.error("[send-inscricao-festival] Unhandled:", err);
    return respond({ error: err?.message ?? "Erro interno" }, 500);
  }
};
