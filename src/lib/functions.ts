const FN = "/.netlify/functions/invite-professor";
const FN_CHECKIN = "/.netlify/functions/send-checkin-email";

export async function inviteProfessor(
  body: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
  try {
    const res = await fetch(FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error) {
      return { data: null, error: (data.error as string) ?? "Erro ao processar" };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "Erro de rede" };
  }
}

export async function sendCheckinEmail(inscricao_id: string): Promise<void> {
  try {
    await fetch(FN_CHECKIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inscricao_id }),
    });
  } catch {
    // não-bloqueante — falha silenciosa
  }
}
