import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export type ImageProviderType = 'gemini' | 'openai' | 'none';

/**
 * Common interface for image generation providers
 */
export interface ImageGenerator {
  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Generate an image from a prompt
   * Returns the image as a Buffer
   */
  generateImage(prompt: string): Promise<Buffer>;

  /**
   * Get the provider type name
   */
  getType(): ImageProviderType;
}

/**
 * Gemini/Google Generative AI Image Generator
 */
export class GeminiImageGenerator implements ImageGenerator {
  private genAI: GoogleGenerativeAI | null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_API_KEY;
    this.genAI = key ? new GoogleGenerativeAI(key) : null;
  }

  isConfigured(): boolean {
    return this.genAI !== null;
  }

  getType(): ImageProviderType {
    return 'gemini';
  }

  async generateImage(prompt: string): Promise<Buffer> {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });

    const result = await model.generateContent([prompt]);
    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    for (const candidate of candidates) {
      if (!candidate.content || !candidate.content.parts) continue;

      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
    }

    throw new Error('No image found in Gemini response parts');
  }
}

/**
 * OpenAI DALL-E Image Generator
 */
export class OpenAIImageGenerator implements ImageGenerator {
  private openai: OpenAI | null;
  private model: string;

  constructor(apiKey?: string, baseURL?: string, model?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (key) {
      this.openai = new OpenAI({
        apiKey: key,
        baseURL: baseURL || process.env.OPENAI_BASE_URL || undefined,
      });
    } else {
      this.openai = null;
    }
    this.model = model || process.env.OPENAI_MODEL || 'dall-e-3';
  }

  isConfigured(): boolean {
    return this.openai !== null;
  }

  getType(): ImageProviderType {
    return 'openai';
  }

  async generateImage(prompt: string): Promise<Buffer> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.openai.images.generate({
      model: this.model,
      prompt: prompt,
      n: 1,
      size: '1792x1024', // 16:9 aspect ratio matching the existing pattern
      response_format: 'b64_json',
      style: 'natural',
    });

    const b64Json = response.data?.[0]?.b64_json;
    if (!b64Json) {
      throw new Error('No image data in OpenAI response');
    }

    return Buffer.from(b64Json, 'base64');
  }
}

/**
 * Get the configured image provider based on environment variables
 */
export function getImageProvider(): ImageGenerator | null {
  const providerType = (process.env.IMAGE_PROVIDER as ImageProviderType) || 'gemini';

  switch (providerType) {
    case 'gemini':
      const gemini = new GeminiImageGenerator();
      return gemini.isConfigured() ? gemini : null;
    case 'openai':
      const openai = new OpenAIImageGenerator();
      return openai.isConfigured() ? openai : null;
    case 'none':
    default:
      return null;
  }
}
