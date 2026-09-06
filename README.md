# Scroluxe App — note tes pubs vidéo automatiquement 🤖

Uploade une pub vidéo → l'IA (Gemini) la regarde → tu obtiens un **score /100** + atouts, défauts et corrections. **100 % gratuit** grâce à l'offre gratuite de Gemini.

---

## 1. Obtenir ta clé Gemini (gratuite, sans carte bancaire)

1. Va sur **https://aistudio.google.com/apikey**
2. Connecte-toi avec un compte Google → **Create API key**.
3. Copie la clé (elle ressemble à `AIza....`). **Garde-la secrète.**

> Offre gratuite : suffisante pour tester (quelques dizaines d'analyses/jour). Aucune carte demandée.

---

## 2. Lancer en local (pour tester)

Il faut **Node.js** installé (https://nodejs.org).

```bash
cd scroluxe-app
npm install
```

Puis définis ta clé et démarre :

**Windows (PowerShell) :**
```powershell
$env:GEMINI_API_KEY="TA_CLE_ICI"
npm start
```

**Mac/Linux :**
```bash
GEMINI_API_KEY="TA_CLE_ICI" npm start
```

Ouvre **http://localhost:3000** → uploade une pub → note.

---

## 3. Mettre en ligne sur Render (gratuit)

⚠️ Cette fois c'est un **Web Service** (pas un Static Site), car il y a un serveur.

1. Pousse ce dossier sur un dépôt GitHub (`scroluxe-app`).
2. Sur **render.com** → **New +** → **Web Service** → choisis le repo.
3. Réglages :
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
4. Onglet **Environment** → **Add Environment Variable** :
   - **Key** : `GEMINI_API_KEY`
   - **Value** : ta clé Gemini
5. **Create Web Service**.

> Ta clé reste **secrète** côté serveur (dans les variables Render), jamais dans le code ni visible par les visiteurs.

---

## Limites de cette version (MVP)
- Vidéos jusqu'à ~100 Mo, idéalement < 3 min.
- L'offre gratuite Gemini a des quotas (ok pour tester, pas pour des milliers d'analyses).
- Analyse la vidéo seule (pas encore la comparaison avec les concurrents — ça viendra avec l'API Meta).

*Fait avec Claude Code.*
