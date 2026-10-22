import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ProductsService } from '../products/products.service';

const RECOGNITION_MODEL = 'claude-haiku-5-5';
const MAX_CANDIDATES = 3;

export type SupportedImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface RecognitionCandidate {
  productId: string;
  confidence: number;
  name: string;
  code?: string;
  price: number;
  priceType: 'fixed' | 'perWeight';
  unit: string;
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);
  private readonly client = new Anthropic();

  constructor(private readonly productsService: ProductsService) {}

  async recognize(
    imageBuffer: Buffer,
    mimeType: SupportedImageMimeType,
    shopId: Types.ObjectId,
  ): Promise<{ candidates: RecognitionCandidate[] }> {
    const products = await this.productsService.findAll(shopId);
    const activeProducts = products.filter((product) => product.active);

    if (activeProducts.length === 0) {
      return { candidates: [] };
    }

    const productIds = activeProducts.map((product) => product.id) as [
      string,
      ...string[],
    ];

    const ResultSchema = z.object({
      candidates: z
        .array(
          z.object({
            productId: z.enum(productIds),
            confidence: z.number().min(0).max(1),
          }),
        )
        .max(MAX_CANDIDATES),
    });

    const catalog = activeProducts
      .map((product) => {
        const category = product.categoryId as unknown as { name?: string } | null;
        return `- id: ${product.id} | name: ${product.name} | category: ${category?.name ?? 'unknown'} | visual cues: ${product.visualDescription ?? 'none provided'}`;
      })
      .join('\n');

    const response = await this.client.messages.parse({
      model: RECOGNITION_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: [
            'You identify a single retail product shown in a photo taken at a store checkout.',
            'Only choose productId values from the catalog below - never invent one that is not listed.',
            `Return up to ${MAX_CANDIDATES} candidates ordered by descending confidence (0 to 1).`,
            'If the photo clearly shows a visually similar category of items sold by weight (e.g. cheese, produce) rather than one exact packaged product, prefer the closest single match but use a lower confidence so the cashier can confirm.',
            'If nothing in the catalog plausibly matches, return an empty candidates array.',
            '',
            'Catalog:',
            catalog,
          ].join('\n'),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: 'Which catalog product is shown in this photo?',
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    if (!response.parsed_output) {
      this.logger.warn('Recognition response did not parse as structured output');
      return { candidates: [] };
    }

    const byId = new Map(activeProducts.map((product) => [product.id, product]));

    const candidates = response.parsed_output.candidates
      .map((match): RecognitionCandidate | null => {
        const product = byId.get(match.productId);
        if (!product) {
          return null;
        }
        return {
          productId: match.productId,
          confidence: match.confidence,
          name: product.name,
          code: product.code,
          price: product.price,
          priceType: product.priceType,
          unit: product.unit,
        };
      })
      .filter((candidate): candidate is RecognitionCandidate => candidate !== null);

    return { candidates };
  }
}
