# Gemini SVG Generation Design

## Context

Currently, SVG explanatory illustrations for tasks are generated using Volc Engine ARK (Doubao) LLM via the `GET /api/tasks/:id/illustration` endpoint. The generated SVG is cached in the `task.illustration` database field and displayed on task cards and in the Arena page.

This design adds Google Gemini generative AI as a configurable alternative provider for SVG generation.

## Goals

- Allow SVG generation to use Gemini instead of ARK via environment configuration
- Maintain backward compatibility - default to existing behavior
- Keep the same caching strategy and response format
- Reuse existing `@google/generative-ai` SDK dependency that's already installed

## Approach

### Configuration

Add three new environment variables to `backend/.env`:

- `SVG_LLM_PROVIDER` - `ark` (default) or `gemini` - selects which provider to use
- `GOOGLE_API_KEY` - already exists for Gemini PNG image generation, reused for SVG
- `GEMINI_SVG_MODEL_ID` - defaults to `gemini-2.0-flash` - allows model selection

### Code Changes

**File: `backend/src/routes/illustration.ts`**

- Import `{ GoogleGenerativeAI }` from `@google/generative-ai`
- Read provider selection and Gemini config from environment
- When `SVG_LLM_PROVIDER=gemini`:
  - Use the same prompt construction logic (system prompt + user prompt)
  - Call `model.generateContent()` via Gemini SDK
  - Extract text response from the candidate
  - Apply the same validation: check starts with `<svg`, scan for dangerous content
  - Cache valid SVG to `task.illustration` in database
  - Return same JSON response format as before

**No changes needed in:**
- Frontend - same endpoint, same response format
- Database schema - `illustration` field already exists as `String?`
- Any other routes or components

### Prompt Engineering

The same prompt strategy will be reused:
- System prompt with style mapping based on task category (M: crime scene diagram, A: concept map, etc.)
- User prompt with task name, category, description
- Same constraints: output only pure SVG, no markdown, specific starting tag, color scheme

### Validation & Error Handling

Same validation rules apply regardless of provider:
- Reject if output doesn't start with `<svg`
- Reject if dangerous content found (`<script`, `onload=`, `javascript:`, etc.)
- On API error, timeout, or validation failure - return `{ svg: null }` and do NOT cache
- In-flight deduplication (prevent concurrent generation for same task) works the same

## Data Flow

```
Request → Check cached SVG in DB → Return if exists
→ Check provider configured (API key present) → Return null if not
→ Check if already generating → Return null if yes
→ Build prompt (same for all providers)
→ Call selected provider (ARK or Gemini)
→ Validate response
→ If valid: cache to DB → return SVG
→ If invalid: return null, don't cache
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SVG_LLM_PROVIDER` | Provider for SVG generation (`ark` or `gemini`) | `ark` |
| `GOOGLE_API_KEY` | Google AI Studio API key (already used for PNG) | - |
| `GEMINI_SVG_MODEL_ID` | Gemini model ID for text/SVG generation | `gemini-2.0-flash` |

## Backward Compatibility

- By default `SVG_LLM_PROVIDER=ark`, so behavior unchanged for existing setups
- Cached SVGs from ARK are still valid and will be served from cache regardless of current provider setting
- Clearing cache would allow regeneration with the new provider

## Risks & Mitigations

- **Gemini might output non-SVG text more frequently**: Same validation handles this, returns null and doesn't cache - same as ARK
- **Different output quality**: Prompt matches the style that worked for ARK, can be adjusted if needed
- **Rate limits**: Handled the same way as API errors - returns null, no crash
