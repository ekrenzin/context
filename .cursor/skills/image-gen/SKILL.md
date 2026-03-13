---
name: image-gen
description: >-
  Generate AI images using OpenAI (DALL-E 3), AWS Bedrock, or Google
  Gemini/Imagen. Requires OPENAI_API_KEY or GEMINI_API_KEY.
related_skills:
  - announce
  - sos-branding
---

# Image Generation

Generate AI images using OpenAI (DALL-E 3), AWS Bedrock, or Google Gemini/Imagen.

## Capabilities

- **OpenAI (Default):** Uses DALL-E 3 for high-quality generation. Requires `OPENAI_API_KEY`.
- **AWS Bedrock:** Uses Titan or Nova Canvas. Requires AWS credentials in `us-east-1` or `us-west-2` (not available in GovCloud West 1).
- **Google Gemini:** Uses Imagen 3/4. Requires `GEMINI_API_KEY`.

## Usage

Run the image generation tool via the ctx CLI.

### Basic (OpenAI DALL-E 3)

```bash
ctx image generate --mode openai --type "a futuristic city"
```

### AWS Bedrock

```bash
ctx image generate --mode bedrock --type "dashboard UI mockup"
```

### Google Gemini (Imagen)

```bash
ctx image generate --mode gemini --type "satellite view map"
```

## Configuration

- **Output:** Images are saved to `playground/images/` by default.
- **API Keys:** set `OPENAI_API_KEY` or `GEMINI_API_KEY` in `.env`.

## Branding

When generating images for your organization's materials (announcement cards, marketing,
presentations), include brand cues in the prompt: dark backgrounds
(`#0A0A0C`), gold accents (`#C9A84C`), and the authority/protection
aesthetic. See `/sos-branding` for the full palette and logo rules.
