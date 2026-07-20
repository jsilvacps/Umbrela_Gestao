/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido." });
  res.status(200).json({ ok: true, debug: "pages router funcionando" });
}
