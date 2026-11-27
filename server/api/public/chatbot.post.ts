import { z } from 'zod'

const MAX_CHATBOT_BODY_BYTES = 16 * 1024

const chatbotRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Tulis pertanyaan terlebih dahulu.')
    .max(400, 'Pesan maksimal 400 karakter.'),
  cart: z
    .object({
      alatCount: z.number().int().min(0).max(500).default(0),
      paketCount: z.number().int().min(0).max(100).default(0),
      durasiHari: z.number().int().min(1).max(30).default(2),
      grandTotal: z.number().min(0).max(500_000_000).default(0),
    })
    .optional(),
  context: z
    .object({
      lastIntent: z.string().max(60).optional(),
      lastAlatIds: z.array(z.number().int().positive()).max(10).optional(),
      lastPaketIds: z.array(z.number().int().positive()).max(10).optional(),
      lastTripIds: z.array(z.number().int().positive()).max(10).optional(),
    })
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'bot']),
        text: z.string().trim().min(1).max(600),
      }),
    )
    .max(8)
    .optional(),
})

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)
  try {
    enforceRateLimit(event, {
      namespace: 'public-chatbot',
      key: ip,
      max: 20,
      windowSec: 60,
      message: 'Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar lalu kirim lagi.',
    })
  } catch (err) {
    await recordSecurityAudit(event, {
      eventType: 'public.chatbot_rate_limited',
      severity: 'warn',
    })
    throw err
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength > MAX_CHATBOT_BODY_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Ukuran pesan terlalu besar.',
    })
  }

  const rawBody = await readBody(event).catch(() => null)
  const parsed = chatbotRequestSchema.safeParse(rawBody)

  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || 'Permintaan tidak valid.'
    throw createError({
      statusCode: 400,
      statusMessage: firstErr,
    })
  }

  const snapshot = await loadChatbotCatalogSnapshot()
  const config = useRuntimeConfig()
  const apiKey = String(config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
  const model = String(
    config.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  ).trim()

  if (apiKey) {
    const llmReply = await tryGenerateGeminiReply({
      apiKey,
      model,
      message: parsed.data.message,
      snapshot,
      cart: parsed.data.cart,
      history: parsed.data.history,
    })
    if (llmReply) {
      return llmReply
    }
  }

  return {
    ...generateChatbotReply(
      parsed.data.message,
      snapshot,
      parsed.data.cart,
      parsed.data.context,
    ),
    source: 'local' as const,
  }
})
