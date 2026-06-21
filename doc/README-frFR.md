# Grounded Q&A pour Zotero

[![Zotero 7](https://img.shields.io/badge/Zotero-7-CC2936?style=flat-square&logo=zotero&logoColor=white)](https://www.zotero.org)
[![Anthropic · OpenAI · Ollama · DeepSeek · Grok](https://img.shields.io/badge/LLM-Anthropic%20·%20OpenAI%20·%20Ollama%20·%20DeepSeek%20·%20Grok-5436DA?style=flat-square)](#-fournisseurs-et-modèles-pris-en-charge)
[![Licence : AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue?style=flat-square)](../LICENSE)
[![Construit avec Zotero Plugin Template](https://img.shields.io/badge/Built%20with-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[English](../README.md) | [Français](README-frFR.md) | [简体中文](README-zhCN.md)

**Posez des questions sur vos articles et obtenez des réponses ancrées dans la source — chaque affirmation est accompagnée d'un lien de page cliquable qui vous amène directement à l'endroit concerné dans le PDF.**

Grounded Q&A lit le texte intégral de vos PDF, envoie votre question au fournisseur d'IA de votre choix et affiche la réponse avec des citations en ligne au format `[Page N]`. Cliquez sur une citation et le lecteur saute à cette page. Fonctionne sur un seul article ouvert dans le lecteur, ou sur plusieurs articles sélectionnés dans votre bibliothèque.

---

## ✨ Fonctionnalités

- **📄 Q&A sur un seul article** — Posez des questions sur le PDF que vous lisez depuis un panneau latéral du lecteur Zotero.
- **📚 Q&A multi-articles** — Sélectionnez plusieurs éléments dans votre bibliothèque et posez une seule question portant sur tous à la fois.
- **🔗 Citations ancrées et cliquables** — Les réponses citent `[Page N]` (un article) ou `[Paper N, Page M]` (multi-articles). Cliquez pour sauter à la page exacte du bon PDF.
- **🧩 Utilisez votre propre modèle** — Anthropic (Claude), OpenAI (GPT), Ollama (local), DeepSeek et Grok (xAI) sont tous pris en charge.
- **🔒 Stockage local de la clé** — Votre clé API réside dans les préférences de Zotero et n'est envoyée nulle part ailleurs que vers le fournisseur que vous choisissez.
- **🖥️ Fonctionne entièrement hors ligne** — Pointez-le vers un serveur [Ollama](https://ollama.com) local pour des réponses privées, sans clé et sans cloud.
- **✅ Tester la connexion** — Un clic dans les Paramètres vérifie votre fournisseur, votre clé et votre modèle avant que vous ne comptiez dessus.

---

## 🚀 Installation

1. Téléchargez le dernier `grounded-q-a.xpi` depuis la [page des versions](https://github.com/birugit/zotero-grounded-qa/releases).
2. Dans Zotero, ouvrez **Outils → Extensions** (ou **Modules complémentaires**).
3. Cliquez sur l'icône d'engrenage ⚙ en haut à droite → **Installer une extension depuis un fichier…**
4. Sélectionnez le fichier `.xpi` téléchargé.
5. **Redémarrez Zotero.**

> [!note]
> Nécessite **Zotero 7**. L'extension a besoin que le texte de chaque PDF soit indexé — ouvrez une fois un PDF dans le lecteur pour que Zotero puisse en extraire le texte, ou utilisez **Bibliothèque → clic droit → Réindexer l'élément**.

---

## 🔑 Configuration

Ouvrez **Zotero → Paramètres (⌘,) → Grounded Q&A** dans le panneau de gauche.

1. **Fournisseur d'IA** — choisissez Anthropic, OpenAI, Ollama, DeepSeek ou Grok.
2. **Clé API** — collez votre clé (non requise pour Ollama). Utilisez le bouton **Show** pour la révéler pendant la saisie.
3. **URL de base** — affichée uniquement pour Ollama ; valeur par défaut `http://localhost:11434`.
4. **Modèle** — choisissez dans la liste de modèles du fournisseur sélectionné.
5. **Tester la connexion** — cliquez pour confirmer que tout fonctionne. En cas de succès, vous verrez `✓ Connected — model "…" OK`.

### Où obtenir une clé API

| Fournisseur | Obtenir une clé | Format de la clé |
| --- | --- | --- |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) → API Keys | `sk-ant-api03-…` |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) → API Keys | `sk-…` |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) → API Keys | `sk-…` |
| **Grok (xAI)** | [console.x.ai](https://console.x.ai) → API Keys | `xai-…` |
| **Ollama** | Aucune clé nécessaire — [installez Ollama](https://ollama.com) et exécutez un modèle localement | — |

---

## 💬 Utilisation

### Un seul article (dans le lecteur)

1. Ouvrez un PDF dans le lecteur Zotero.
2. Dans le panneau d'élément à droite, ouvrez la section **Grounded Q&A** (icône de livre dans la barre latérale).
3. Saisissez une question et appuyez sur **Ask** (ou `Ctrl/⌘ + Entrée`).
4. La réponse apparaît avec des citations cliquables `[Page N]` — cliquez sur l'une d'elles pour sauter à cette page.

### Sur plusieurs articles (dans la bibliothèque)

1. Dans votre bibliothèque, **sélectionnez 2 éléments ou plus** ayant des pièces jointes PDF.
2. **Clic droit → « Q&A: Ask across selected papers ».**
3. L'extension extrait le texte de chaque article (en ignorant ceux dont le texte n'est pas extractible), puis ouvre une boîte de dialogue.
4. Posez votre question. La réponse cite `[Paper N, Page M]` — cliquez sur une citation pour ouvrir **cet** article à la page citée.

> [!tip]
> Les questions multi-articles sont idéales pour comparer la littérature, par ex. *« En quoi ces articles diffèrent-ils dans leur protocole expérimental ? »* ou *« Quel article rapporte la précision la plus élevée, et sur quel jeu de données ? »*

---

## 🧩 Fournisseurs et modèles pris en charge

| Fournisseur | Point de terminaison | Modèles |
| --- | --- | --- |
| **Anthropic (Claude)** | `https://api.anthropic.com` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8` |
| **OpenAI (GPT)** | `https://api.openai.com` | `gpt-5.3-instant`, `gpt-5.4-pro`, `gpt-5.4-thinking` |
| **Ollama (local)** | `http://localhost:11434` | `llama3.2`, `llama3.1`, `mistral`, `qwen2.5`, `gemma3` |
| **DeepSeek** | `https://api.deepseek.com` | `deepseek-r1` |
| **Grok (xAI)** | `https://api.x.ai` | `grok-4.3`, `grok-4.20` |

Tous les fournisseurs cloud sont appelés via leur point de terminaison `/v1/chat/completions` compatible OpenAI, sauf Anthropic, qui utilise son API native `/v1/messages`.

---

## 🗂️ Fonctionnement

1. **Extraction** — Le texte du PDF est récupéré page par page via le `PDFWorker` de Zotero, avec repli sur l'index plein texte de Zotero. Les pages sont suivies afin que les citations puissent être reliées à un emplacement.
2. **Construction du contexte** — Le texte des pages est assemblé avec des marqueurs `[Page N]`, plafonné à environ 80 000 caractères. Pour les questions multi-articles, le budget est réparti équitablement entre les articles (plafond par article), et les longs articles sont tronqués.
3. **Interrogation** — La question et le contexte sont envoyés au fournisseur choisi avec une consigne système demandant au modèle de citer chaque affirmation par page.
4. **Rendu** — Les citations de la réponse sont analysées et transformées en liens cliquables qui amènent le lecteur à la page citée.

---

## 🛠️ Développement

Construit sur le [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) et [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold).

```bash
# installer les dépendances
npm install

# lancer un Zotero de dev avec l'extension chargée + rechargement à chaud à chaque modification
npm run start

# construire un .xpi de production (sortie dans .scaffold/build/)
npm run build

# lint / formatage
npm run lint:fix
```

La sortie de build `.scaffold/build/grounded-q-a.xpi` peut être installée manuellement via **Outils → Extensions → ⚙ → Installer une extension depuis un fichier…**

### Structure du projet

```
addon/
  content/preferences.xhtml      # Interface du panneau de paramètres
  locale/**/preferences.ftl      # Chaînes localisées (en-US, zh-CN)
  prefs.js                       # Valeurs de préférences par défaut
src/
  hooks.ts                       # Cycle de vie de l'extension + enregistrement des menus
  modules/
    qaPanel.ts                   # Panneau du lecteur + dialogue multi-articles + citations
    pdfExtractor.ts              # Extraction du texte PDF page par page
    llmClient.ts                 # Appels d'API des fournisseurs + construction du contexte
    preferenceScript.ts          # Logique du panneau de paramètres (fournisseur/modèle/test)
```

---

## 🔍 Dépannage

**« No text found in this PDF. »**
Zotero n'a pas indexé le texte du PDF. Ouvrez-le une fois dans le lecteur, ou faites un clic droit sur l'élément → **Réindexer l'élément**. Les PDF uniquement composés d'images / numérisés sans OCR n'ont pas de texte extractible.

**« API key not set. »**
Ajoutez votre clé dans **Paramètres → Grounded Q&A**, puis cliquez sur **Test connection** pour confirmer. (Non requise pour Ollama.)

**Le test de connexion échoue avec une erreur HTTP.**
- `401` — clé API erronée ou expirée.
- `404` / erreur de modèle — le modèle sélectionné n'est pas disponible sur votre compte ; choisissez-en un autre.
- Pour Ollama, assurez-vous que le serveur est en cours d'exécution (`ollama serve`) et que le modèle est téléchargé (`ollama pull llama3.2`).

**Les citations ne sont pas cliquables.**
Cela se produit si le modèle n'a pas utilisé le format de citation attendu. Essayez un modèle plus performant (par ex. Claude Sonnet/Opus ou GPT-5.4 Pro), qui suivent plus fidèlement les consignes de citation.

**Besoin de plus de détails ?**
Ouvrez **Aide → Journalisation de la sortie de débogage → Afficher la sortie** et recherchez les lignes commençant par `[GroundedQA]`.

---

## 📄 Licence

Distribué sous licence **AGPL-3.0-or-later**. Voir [LICENSE](../LICENSE).

Aucune garantie n'est fournie. Vous êtes responsable des coûts d'utilisation éventuels engagés auprès du fournisseur d'IA que vous choisissez.
