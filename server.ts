import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PARSE_SYSTEM_INSTRUCTION = `Kamu adalah asisten pencatatan Jurnal Trading Forex. Tugasmu mengekstrak daftar transaksi forex dari catatan teks atau screenshot history trading menjadi data terstruktur dalam Bahasa Indonesia.

Untuk setiap transaksi, tentukan:
- dateKey: format YYYY-MM-DD (jika tahun tidak disebut, gunakan tahun dari tanggal referensi saat ini)
- session: wajib salah satu dari "Asia", "London", atau "New York" (perkirakan dari jam atau keterangan sesi, default "London")
- pair: simbol pair huruf besar seperti "XAUUSD", "EURUSD", "GBPUSD", "USDJPY"
- position: wajib "Buy" atau "Sell"
- method: nama metode / strategi setup yang digunakan (contoh: "Breakout Structure", "Pullback EMA", "Supply & Demand", "SMC / FVG", "Support & Resistance", "Counter-Trend Scalping"). Jika tidak disebut, simpulkan ringkas dari catatan atau isi "Setup Umum".
- riskPercent: angka persentase risiko per trade (default 1.5 jika tidak disebut)
- outcome: wajib "Win", "Loss", atau "BE"
- pnlIdr: angka bulat Rupiah bertanda (+ untuk Win, - untuk Loss, 0 untuk BE). Jika dalam USD atau ribuan (misal "+15rb", "-10k"), konversi ke angka penuh Rupiah (jika USD tanpa kurs, gunakan Rp16.000/USD).
- note: catatan singkat setup & kondisi eksekusi (maks 1 kalimat).`;

const app = express();
app.use(express.json({ limit: '15mb' }));

app.post('/api/analyze-trades', async (req, res) => {
  const ai = createGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'GEMINI_API_KEY belum terkonfigurasi di environment server. Silakan gunakan tab Input Manual untuk mencatat trade.',
    });
    return;
  }

  try {
    const {
      rawText = '',
      imageBase64,
      imageMimeType,
      referenceDate,
    } = req.body as {
      rawText?: string;
      imageBase64?: string;
      imageMimeType?: string;
      referenceDate?: string;
    };

    const trimmedText = typeof rawText === 'string' ? rawText.trim() : '';
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0;

    if (!trimmedText && !hasImage) {
      res.status(400).json({
        error: 'Isi catatan trade atau lampirkan screenshot terlebih dahulu.',
      });
      return;
    }

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (hasImage) {
      const allowedMime =
        typeof imageMimeType === 'string' && imageMimeType.startsWith('image/')
          ? imageMimeType
          : 'image/png';
      parts.push({
        inlineData: {
          mimeType: allowedMime,
          data: imageBase64,
        },
      });
    }

    const promptText = [
      `Tanggal referensi: ${referenceDate || new Date().toISOString().slice(0, 10)}.`,
      trimmedText
        ? `Catatan transaksi dari user:\n${trimmedText}`
        : 'Ekstrak seluruh transaksi yang terlihat pada screenshot terlampir.',
    ].join('\n\n');

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: PARSE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parsedTrades: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dateKey: { type: Type.STRING },
                  session: { type: Type.STRING },
                  pair: { type: Type.STRING },
                  position: { type: Type.STRING },
                  method: { type: Type.STRING },
                  riskPercent: { type: Type.NUMBER },
                  outcome: { type: Type.STRING },
                  pnlIdr: { type: Type.NUMBER },
                  note: { type: Type.STRING },
                },
                required: [
                  'dateKey',
                  'session',
                  'pair',
                  'position',
                  'method',
                  'riskPercent',
                  'outcome',
                  'pnlIdr',
                  'note',
                ],
              },
            },
          },
          required: ['parsedTrades'],
        },
      },
    });

    const jsonStr = (response.text ?? '{}').trim();
    const parsed = JSON.parse(jsonStr);
    res.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses data trade.';
    res.status(500).json({
      error: `Gagal memproses impor catatan: ${message}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JurnalFx server listening on http://localhost:${PORT}`);
  });
}

startServer();
