# Gemini SVG Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Gemini generative AI as a configurable provider for SVG illustration generation alongside the existing Volc Engine ARK provider.

**Architecture:** Modify `backend/src/routes/illustration.ts` to support configurable provider selection via the `SVG_LLM_PROVIDER` environment variable. Reuse the existing `@google/generative-ai` SDK that's already installed for PNG image generation. Keep the same caching strategy, response format, and validation logic regardless of provider.

**Tech Stack:** Node.js + Express + TypeScript + @google/generative-ai + Prisma

---

### Task 1: Add environment variable documentation to .env.example (if exists) and update .env

**Files:**
- Modify: `backend/.env` (add new variables)
- Check: `backend/.env.example` (create or update if it exists)

- [ ] **Step 1: Read the current .env file** (already done, context confirms current content)

- [ ] **Step 2: Add Gemini configuration to backend/.env**

Append these lines at the end of `backend/.env`:

```ini
# Gemini SVG generation configuration
# SVG_LLM_PROVIDER can be "ark" (default) or "gemini"
SVG_LLM_PROVIDER=gemini
# GOOGLE_API_KEY is already used for Gemini PNG image generation
GOOGLE_API_KEY=AIzaSyDrp3jT96AxsecCEYRsrBQ4Jm07CeWEgkM
# Gemini model for SVG text generation
GEMINI_SVG_MODEL_ID=gemini-2.0-flash
```

- [ ] **Step 3: Commit**

```bash
git add backend/.env
git commit -m "config: add Gemini SVG environment variables"
```

---

### Task 2: Modify illustration.ts to add Gemini support

**Files:**
- Modify: `backend/src/routes/illustration.ts`

- [ ] **Step 1: Add Gemini import and config reading**

Modify the imports and config section (around lines 1-12):

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const prisma = new PrismaClient();

// Read at request time so dotenv.config() in index.ts takes effect before first request
const arkBaseUrl = () => process.env.VOLC_ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const arkApiKey = () => process.env.VOLC_ARK_API_KEY;
const arkModelId = () => process.env.VOLC_ARK_MODEL_ID || 'doubao-1.5-pro-256k';

// Gemini config
const svgProvider = () => process.env.SVG_LLM_PROVIDER || 'ark';
const googleApiKey = () => process.env.GOOGLE_API_KEY;
const geminiModelId = () => process.env.GEMINI_SVG_MODEL_ID || 'gemini-2.0-flash';

// Initialize Gemini once
const genAI = googleApiKey() ? new GoogleGenerativeAI(googleApiKey()!) : null;
```

- [ ] **Step 2: Extract common prompt building to reusable function (already exists as `buildSystemPrompt`)**

The `buildSystemPrompt` function already exists (lines 26-38) and works for both providers. No changes needed.

- [ ] **Step 3: Add Gemini generation logic after ARK call**

Refactor the generation section (lines 78-114) to use a conditional based on provider:

```typescript
    let svgContent: string | null = null;

    const provider = svgProvider();

    try {
      if (provider === 'gemini' && genAI) {
        // Generate via Gemini
        const model = genAI.getGenerativeModel({ model: geminiModelId() });
        const result = await model.generateContent([
          { text: systemPrompt },
          { text: userPrompt }
        ]);
        const response = await result.response;
        const raw = response.text() || '';
        const trimmed = raw.trim();

        const DANGEROUS_SVG = /<script|on\w+\s*=|javascript:|<foreignObject|<animate/i;
        if (trimmed.toLowerCase().startsWith('<svg') && !DANGEROUS_SVG.test(trimmed)) {
          svgContent = trimmed;
        } else {
          console.warn(`[illustration] Non-SVG response from Gemini for task ${id}:`, trimmed.slice(0, 100));
        }
      } else {
        // Generate via ARK
        const response = await axios.post(
          `${arkBaseUrl()}/chat/completions`,
          {
            model: arkModelId(),
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            stream: false,
            max_tokens: 4096,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
            proxy: false,
          }
        );

        const raw: string = response.data?.choices?.[0]?.message?.content ?? '';
        const trimmed = raw.trim();

        const DANGEROUS_SVG = /<script|on\w+\s*=|javascript:|<foreignObject|<animate/i;
        if (trimmed.toLowerCase().startsWith('<svg') && !DANGEROUS_SVG.test(trimmed)) {
          svgContent = trimmed;
        } else {
          console.warn(`[illustration] Non-SVG response for task ${id}:`, trimmed.slice(0, 100));
        }
      }
```

The DANGEROUS_SVG regex is duplicated for both branches because it's only used when generation happens. This keeps each branch self-contained.

- [ ] **Step 4: Update API key check**

Modify the API key check around line 59-64:

```typescript
    // Check if selected provider is configured
    const provider = svgProvider();
    if (provider === 'ark' && !arkApiKey()) {
      console.warn('[illustration] VOLC_ARK_API_KEY not set');
      return res.json({ success: true, data: { svg: null } });
    }
    if (provider === 'gemini' && !googleApiKey()) {
      console.warn('[illustration] GOOGLE_API_KEY not set');
      return res.json({ success: true, data: { svg: null } });
    }
```

- [ ] **Step 5: Move DANGEROUS_SVG to top-level** (optional cleanup)

The DANGEROUS_SVG regex is currently duplicated. You can move it to the top after the config section:

```typescript
// SVG content security filter
const DANGEROUS_SVG = /<script|on\w+\s*=|javascript:|<foreignObject|<animate/i;
```

And remove from both generation branches. This reduces code duplication.

- [ ] **Step 6: Compile check to verify TypeScript types**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/illustration.ts
git commit -m "feat: add Gemini as configurable SVG generation provider"
```

---

### Task 3: Test end-to-end functionality

**Files:** None to modify, runtime testing only.

- [ ] **Step 1: Start the backend dev server**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: Clear any cached SVG from the database** (optional - for testing generation from scratch)

If you want to test fresh generation:

```bash
cd backend
npx prisma db execute --stdin <<'EOF'
UPDATE task SET illustration = NULL WHERE illustration IS NOT NULL;
EOF
```

- [ ] **Step 3: Test the endpoint**

Replace `M001` with any task ID in your database:

```bash
curl http://localhost:3001/api/tasks/M001/illustration
```

Expected output format:
```json
{"success":true,"data":{"svg":"<svg xmlns=\"http://www.w3.org/2000/svg\" ... </svg>"}}
```

Or if generation fails:
```json
{"success":true,"data":{"svg":null}}
```

- [ ] **Step 4: Verify the generated SVG is cached in the database**

```bash
cd backend
npx prisma db execute --stdin <<'EOF'
SELECT id, length(illustration) FROM task WHERE id = 'M001';
EOF
```

Expected: `length(illustration)` is non-null and greater than 100.

- [ ] **Step 5: Test frontend rendering**

Open `http://localhost:5173` in a browser. Check that:
- Task cards show the SVG thumbnail (or Gemini-generated PNG if that's enabled)
- Navigate to the Arena page for that task and verify the full-size illustration renders correctly

- [ ] **Step 6: Test switching back to ARK provider**

Change `SVG_LLM_PROVIDER=ark` in `backend/.env`, restart the server, and verify it still works as before.

---

## Self-Review

- **Spec coverage:** All requirements covered - configurable provider, environment variable selection, reuses existing Gemini SDK, maintains backward compatibility, same caching and validation.
- **Placeholders:** All file paths, code changes, and commands are fully specified.
- **Type consistency:** Uses existing types from the GoogleGenerativeAI SDK that's already installed. All variables are consistently named.
