import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { unpackSessionCookie } from "../lib/crypto.js";
import { loadSession } from "../auth/session.js";
import { audit } from "../lib/audit.js";
import { SESSION_COOKIE } from "./auth.js";
import { betigiYukle, engelGirdisi, sieveBetigi, ENGEL_SINIRI } from "../mail/engel.js";

async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  const cookie = req.cookies[SESSION_COOKIE];
  const unpacked = cookie ? unpackSessionCookie(cookie) : null;
  if (!unpacked) {
    reply.code(401).send({ error: "Oturum yok" });
    return null;
  }
  const session = await loadSession(unpacked.sessionId, unpacked.sessionKey);
  if (!session) {
    reply.code(401).send({ error: "Oturum geçersiz" });
    return null;
  }
  return session;
}

async function ayarlar(userId: number): Promise<Record<string, unknown>> {
  const [u] = await db.select({ settings: users.settings }).from(users).where(eq(users.id, userId)).limit(1);
  return (u?.settings as Record<string, unknown> | null) ?? {};
}

function listeOku(a: Record<string, unknown>): string[] {
  const l = z.array(z.string()).safeParse(a["engellenenler"]);
  return l.success ? l.data : [];
}

/**
 * Engel listesi. Tek kaynak kullanıcının settings.engellenenler alanı;
 * Sieve betiği her değişiklikte ondan yeniden üretiliyor. Betik
 * yüklenemezse kayıt da yapılmıyor — liste ile gerçekte çalışan filtre
 * ayrışmasın.
 */
export async function engelRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/engel", async (req, reply) => {
    const session = await requireSession(req, reply);
    if (!session) return;
    return reply.send({ liste: listeOku(await ayarlar(session.userId)) });
  });

  app.post(
    "/api/engel",
    { config: { rateLimit: { max: 60, timeWindow: "10 minutes" } } },
    async (req, reply) => {
      const session = await requireSession(req, reply);
      if (!session) return;

      const govde = z
        .object({ adres: engelGirdisi, kaldir: z.boolean().default(false) })
        .safeParse(req.body);
      if (!govde.success) {
        return reply.code(400).send({ error: govde.error.issues[0]?.message ?? "Geçersiz adres" });
      }
      const { adres, kaldir } = govde.data;
      if (!kaldir && adres === session.email.toLowerCase()) {
        return reply.code(400).send({ error: "Kendi adresini engelleyemezsin" });
      }

      const mevcut = await ayarlar(session.userId);
      const eski = listeOku(mevcut);
      const yeni = kaldir ? eski.filter((a) => a !== adres) : [...new Set([...eski, adres])];
      if (yeni.length > ENGEL_SINIRI) {
        return reply.code(400).send({ error: `En fazla ${ENGEL_SINIRI} adres engellenebilir` });
      }

      try {
        await betigiYukle({ user: session.email, pass: session.imapPassword }, sieveBetigi(yeni));
      } catch (err) {
        req.log.error({ err }, "sieve betiği yüklenemedi");
        return reply.code(502).send({ error: "Engel sunucuya yazılamadı, tekrar dene" });
      }

      await db
        .update(users)
        .set({ settings: { ...mevcut, engellenenler: yeni }, updatedAt: new Date() })
        .where(eq(users.id, session.userId));

      await audit({
        userId: session.userId,
        action: kaldir ? "engel.kaldir" : "engel.ekle",
        detail: adres,
        ip: req.ip,
      });
      return reply.send({ liste: yeni });
    },
  );
}
