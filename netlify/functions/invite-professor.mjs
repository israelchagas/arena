import { createClient } from "@supabase/supabase-js";

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

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function emailHtml(nome, email, password, loginUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);padding:36px 40px;text-align:center;">
      <div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-1px;">🏆 Arena</div>
      <div style="font-size:13px;color:#93c5fd;margin-top:6px;">Gestão de Eventos Esportivos</div>
    </td>
  </tr>
  <tr>
    <td style="padding:36px 40px;">
      <p style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 8px;">Olá, ${nome}! 👋</p>
      <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0 0 28px;">
        Seu cadastro foi <strong style="color:#16a34a;">aprovado</strong>! Use as credenciais abaixo para acessar o sistema.
      </p>
      <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:28px;">
        <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 18px;">Suas credenciais de acesso</p>
        <div style="margin-bottom:14px;">
          <p style="font-size:11px;font-weight:600;color:#94a3b8;margin:0 0 5px;text-transform:uppercase;letter-spacing:.5px;">E-mail (usuário)</p>
          <div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 16px;">
            <p style="font-size:15px;font-weight:600;color:#0f172a;margin:0;">${email}</p>
          </div>
        </div>
        <div>
          <p style="font-size:11px;font-weight:600;color:#94a3b8;margin:0 0 5px;text-transform:uppercase;letter-spacing:.5px;">Senha temporária</p>
          <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 16px;">
            <p style="font-size:20px;font-weight:900;color:#1d4ed8;margin:0;letter-spacing:3px;font-family:'Courier New',monospace;">${password}</p>
          </div>
        </div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <a href="${loginUrl}/login" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:15px 42px;border-radius:12px;">Acessar o sistema →</a>
        </td></tr>
      </table>
      <div style="margin-top:24px;padding:16px;background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;">
        <p style="font-size:13px;color:#92400e;margin:0;line-height:1.6;">
          ⚠️ <strong>Importante:</strong> Recomendamos alterar sua senha após o primeiro acesso.
        </p>
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.6;">
        Arena · Gestão de Eventos Esportivos<br>Este e-mail foi gerado automaticamente.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendResend(apiKey, to, nome, email, password, appUrl) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Arena <matricula@culturadecampeoes.com.br>",
      to: [to],
      subject: "🏆 Cadastro aprovado — Suas credenciais de acesso · Arena",
      html: emailHtml(nome, email, password, appUrl),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[invite-professor] Resend error:", body);
    throw new Error(`Resend: ${body}`);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "ok" };
  }
  if (event.httpMethod !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl  = process.env.SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey    = process.env.RESEND_API_KEY ?? "";
    const appUrl       = process.env.APP_URL ?? "http://localhost:8888";

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Variáveis de ambiente não configuradas" }, 500);
    }

    const body   = JSON.parse(event.body ?? "{}");
    const { action } = body;

    const clientOpts = (schema) => ({
      db: { schema },
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { timeout: 1 },
      global: { fetch },
    });

    const authClient = createClient(supabaseUrl, serviceKey, clientOpts("public"));
    const arena = createClient(supabaseUrl, serviceKey, clientOpts("arena"));

    // ── Approve ────────────────────────────────────────────────────────────
    if (action === "approve") {
      const { professor_id } = body;
      if (!professor_id) return respond({ error: "professor_id obrigatório" }, 400);

      const { data: prof, error: profErr } = await arena
        .from("professores").select("*").eq("id", professor_id).single();

      if (profErr || !prof) return respond({ error: "Professor não encontrado" }, 404);
      if (prof.status === "ativo") return respond({ error: "Professor já aprovado" }, 409);

      const password = generatePassword();

      const { data: authData, error: authErr } = await authClient.auth.admin.createUser({
        email: prof.email,
        password,
        email_confirm: true,
        user_metadata: { nome: prof.nome },
      });

      if (authErr) {
        const conflict = authErr.message.toLowerCase().includes("already");
        return respond({ error: conflict ? "Este e-mail já possui cadastro" : authErr.message }, conflict ? 409 : 500);
      }

      const userId = authData.user.id;

      const { data: profileData, error: profileErr } = await arena
        .from("profiles").insert({ user_id: userId, role: "professor", nome: prof.nome })
        .select("id").single();

      if (profileErr) {
        await authClient.auth.admin.deleteUser(userId);
        throw profileErr;
      }

      // Tenta vincular associacao_id a partir do nome informado no cadastro
      let associacaoId = prof.associacao_id ?? null;
      if (!associacaoId && prof.associacao_nome) {
        const { data: assocMatch } = await arena
          .from("associacoes")
          .select("id")
          .eq("evento_id", prof.evento_id)
          .ilike("nome", prof.associacao_nome.trim())
          .limit(1)
          .single();
        if (assocMatch) associacaoId = assocMatch.id;
      }

      const { error: updateErr } = await arena
        .from("professores")
        .update({
          profile_id: profileData.id,
          associacao_id: associacaoId,
          status: "ativo",
          invited_at: new Date().toISOString(),
        })
        .eq("id", professor_id);

      if (updateErr) {
        await authClient.auth.admin.deleteUser(userId);
        throw updateErr;
      }

      try {
        await sendResend(resendKey, prof.email, prof.nome, prof.email, password, appUrl);
      } catch (e) {
        console.error("[invite-professor] Email failed (non-fatal):", e);
      }

      return respond({ success: true });
    }

    // ── Reject ─────────────────────────────────────────────────────────────
    if (action === "reject") {
      const { professor_id } = body;
      if (!professor_id) return respond({ error: "professor_id obrigatório" }, 400);

      const { error } = await arena
        .from("professores").update({ status: "rejeitado" }).eq("id", professor_id);
      if (error) throw error;
      return respond({ success: true });
    }

    // ── Resend invite ──────────────────────────────────────────────────────
    if (action === "resend") {
      const { professor_id } = body;
      if (!professor_id) return respond({ error: "professor_id obrigatório" }, 400);

      const { data: prof, error: profErr } = await arena
        .from("professores").select("id, nome, email, profile_id").eq("id", professor_id).single();

      if (profErr || !prof) return respond({ error: "Professor não encontrado" }, 404);

      const newPassword = generatePassword();

      if (prof.profile_id) {
        const { data: profile } = await arena
          .from("profiles").select("user_id").eq("id", prof.profile_id).single();
        if (profile?.user_id) {
          await authClient.auth.admin.updateUserById(profile.user_id, { password: newPassword });
        }
      }

      try {
        await sendResend(resendKey, prof.email, prof.nome, prof.email, newPassword, appUrl);
      } catch (e) {
        console.error("[invite-professor] Resend failed:", e);
      }

      return respond({ success: true });
    }

    // ── Create (admin cadastra direto) ─────────────────────────────────────
    if (action === "create") {
      const { nome, cpf, email, telefone, graduacao, evento_id, associacao_id } = body;
      if (!nome || !email || !evento_id || !associacao_id) {
        return respond({ error: "Campos obrigatórios: nome, email, evento_id, associacao_id" }, 400);
      }

      const password = generatePassword();

      const { data: authData, error: authErr } = await authClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome },
      });

      if (authErr) {
        const conflict = authErr.message.toLowerCase().includes("already");
        return respond({ error: conflict ? "Este e-mail já possui cadastro" : authErr.message }, conflict ? 409 : 500);
      }

      const userId = authData.user.id;

      const { data: profileData, error: profileErr } = await arena
        .from("profiles").insert({ user_id: userId, role: "professor", nome })
        .select("id").single();

      if (profileErr) {
        await authClient.auth.admin.deleteUser(userId);
        throw profileErr;
      }

      const { error: insertErr } = await arena.from("professores").insert({
        profile_id: profileData.id,
        nome,
        cpf: cpf ?? null,
        email,
        telefone: telefone ?? null,
        graduacao: graduacao ?? null,
        evento_id,
        associacao_id,
        status: "ativo",
        invited_at: new Date().toISOString(),
      });

      if (insertErr) {
        await authClient.auth.admin.deleteUser(userId);
        throw insertErr;
      }

      try {
        await sendResend(resendKey, email, nome, email, password, appUrl);
      } catch (e) {
        console.error("[invite-professor] Email failed (non-fatal):", e);
      }

      return respond({ success: true, userId });
    }

    return respond({ error: "Ação inválida" }, 400);

  } catch (err) {
    console.error("[invite-professor] Unhandled:", err);
    return respond({ error: err?.message ?? "Erro interno" }, 500);
  }
};
