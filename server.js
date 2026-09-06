// Scroluxe — serveur d'analyse de pubs vidéo beauté via Gemini (offre gratuite)
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// La clé Gemini vient d'une variable d'environnement (jamais dans le code).
// En local : mets-la dans un fichier .env ou exporte GEMINI_API_KEY.
// Sur Render : ajoute-la dans Environment > GEMINI_API_KEY.
const API_KEY = process.env.GEMINI_API_KEY;

const upload = multer({
  dest: path.join(__dirname, "uploads"),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 Mo max
});

app.use(express.static(path.join(__dirname, "public")));

// Le "cerveau" : les consignes données à Gemini pour noter une pub beauté.
const PROMPT = `Tu es Scroluxe, un expert du pré-test de créas publicitaires pour marques de beauté (skincare).
Analyse cette vidéo de publicité comme un stratège créa. Sois précis, honnête et actionnable.

Règle d'or : tu ne promets JAMAIS de ventes. Tu juges si la pub va ACCROCHER (arrêter le scroll) et se DÉMARQUER.

Évalue : le HOOK (3 premières secondes), le RYTHME/montage, l'ANGLE, le TEXTE à l'écran/sous-titres, le moment d'apparition du PRODUIT, la DÉMARCATION vs les autres pubs beauté.

>>> EXIGENCE CAPITALE SUR LES RECOMMANDATIONS <<<
Chaque reco doit être une INSTRUCTION EXÉCUTABLE que le client peut appliquer sans réfléchir. INTERDIT les conseils vagues du type "renforce le CTA" ou "améliore le hook".
Chaque reco DOIT contenir les 3 éléments :
1. QUOI faire précisément,
2. OÙ / QUAND dans la vidéo (le moment exact, ex: "dans la 1ʳᵉ seconde", "à 0:08", "sur le plan final"),
3. un EXEMPLE CONCRET (le texte exact à écrire/dire, ou le visuel précis à filmer).
Mauvais exemple (INTERDIT) : "Ajoute une preuve sociale."
Bon exemple (ATTENDU) : "À 0:05, ajoute une incrustation texte blanche sur fond rose : « Approuvé par 12 000 clientes ★★★★★ » pendant 2 secondes."

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte autour), de cette forme exacte :
{
  "score": <entier 0-100>,
  "verdict": "<'Arrête le scroll' ou 'Moyen' ou 'Se fond dans la masse'>",
  "hook": "<1 phrase sur la force ou faiblesse des 3 premières secondes>",
  "atouts": ["<atout 1>", "<atout 2>", "<atout 3>"],
  "defauts": ["<défaut 1>", "<défaut 2>", "<défaut 3>"],
  "recos": ["<instruction exécutable avec QUOI + OÙ/QUAND + EXEMPLE concret>", "<idem 2>", "<idem 3>", "<idem 4>"],
  "hooks_reecrits": ["<accroche prête à l'emploi, texte exact pour la 1ʳᵉ seconde>", "<accroche alternative 2>", "<accroche alternative 3>"],
  "angle": "<l'angle principal détecté>"
}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.post("/api/analyze", upload.single("video"), async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Clé Gemini manquante. Ajoute GEMINI_API_KEY dans les variables d'environnement." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Aucune vidéo reçue." });
  }

  const localPath = req.file.path;
  const cleanup = () => { try { fs.unlinkSync(localPath); } catch (_) {} };

  try {
    const fileManager = new GoogleAIFileManager(API_KEY);
    const genAI = new GoogleGenerativeAI(API_KEY);

    // 1) Envoyer la vidéo à Gemini
    const uploaded = await fileManager.uploadFile(localPath, {
      mimeType: req.file.mimetype || "video/mp4",
      displayName: req.file.originalname || "pub.mp4",
    });

    // 2) Attendre que Gemini ait fini de la traiter
    let file = await fileManager.getFile(uploaded.file.name);
    let waited = 0;
    while (file.state === FileState.PROCESSING && waited < 120000) {
      await sleep(3000);
      waited += 3000;
      file = await fileManager.getFile(uploaded.file.name);
    }
    if (file.state !== FileState.ACTIVE) {
      cleanup();
      return res.status(500).json({ error: "Gemini n'a pas pu traiter la vidéo (trop longue ou format non supporté)." });
    }

    // 3) Demander l'analyse
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
    const parts = [
      { fileData: { fileUri: file.uri, mimeType: file.mimeType } },
      { text: PROMPT },
    ];
    // Ré-essai automatique si Gemini est temporairement surchargé (503) ou limité (429).
    let result;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        result = await model.generateContent(parts);
        break;
      } catch (e) {
        const msg = String(e?.message || "");
        const retryable = /\b(503|429)\b|overload|high demand|unavailable|rate|quota/i.test(msg);
        if (attempt < 3 && retryable) {
          await sleep(5000 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }

    cleanup();

    // 4) Extraire le JSON (Gemini peut l'entourer de ```json … ```)
    let text = result.response.text().trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return res.status(502).json({ error: "Réponse illisible de l'IA.", raw: text });
    }
    return res.json(data);
  } catch (err) {
    cleanup();
    console.error(err);
    return res.status(500).json({ error: "Erreur pendant l'analyse : " + (err?.message || "inconnue") });
  }
});

app.get("/health", (_, res) => res.json({ ok: true, hasKey: !!API_KEY }));

app.listen(PORT, () => console.log(`Scroluxe app en écoute sur le port ${PORT}`));
