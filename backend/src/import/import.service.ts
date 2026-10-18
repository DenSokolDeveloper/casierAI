import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { Product, ProductDocument, PriceType } from '../products/product.schema';
import { Category, CategoryDocument } from '../categories/category.schema';
import { CommitImportRowDto } from './dto/commit-import.dto';

const INFERENCE_MODEL = 'claude-haiku-5-5';
const AI_BATCH_SIZE = 120;

const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ['name', 'название', 'назва', 'nazwa', 'товар', 'produkt', 'product', 'найменування'],
  price: ['price', 'цена', 'ціна', 'cena', 'стоимость', 'вартість'],
  category: ['category', 'категория', 'категорія', 'kategoria'],
  stock: [
    'stock',
    'остаток',
    'залишок',
    'stan',
    'qty',
    'quantity',
    'количество',
    'кількість',
    'ilość',
    'ilosc',
  ],
  unit: ['unit', 'единица', 'одиниця', 'jednostka'],
};

type ColumnField = 'name' | 'price' | 'category' | 'stock' | 'unit';

export interface PreviewRow {
  name: string;
  price: number;
  priceType: PriceType;
  unit: string;
  stockQty: number;
  categoryName: string;
  categoryIsNew: boolean;
}

export interface PreviewResult {
  rows: PreviewRow[];
  errors: string[];
  aiUsed: boolean;
}

function normalizeHeader(header: unknown): string {
  return String(header ?? '').trim().toLowerCase();
}

function resolveColumnMap(headers: string[]): Partial<Record<ColumnField, string>> {
  const map: Partial<Record<ColumnField, string>> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [ColumnField, string[]][]) {
      if (!map[field] && synonyms.some((syn) => normalized === syn || normalized.includes(syn))) {
        map[field] = header;
      }
    }
  }
  return map;
}

function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
    const value = Number.parseFloat(cleaned);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function parseStock(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const value = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

interface RawRow {
  rowNumber: number;
  name: string;
  price: number;
  stockQty: number;
  unit: string;
  explicitCategory: string | null;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly client = new Anthropic();

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async preview(buffer: Buffer, shopId: Types.ObjectId): Promise<PreviewResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('The file has no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (records.length === 0) {
      throw new BadRequestException('The file has no data rows');
    }

    const headers = Object.keys(records[0]);
    const columnMap = resolveColumnMap(headers);
    if (!columnMap.name) {
      throw new BadRequestException(
        'Could not find a product name column. Expected a header like "Name"/"Название"/"Nazwa".',
      );
    }

    const errors: string[] = [];
    const rawRows: RawRow[] = [];

    records.forEach((record, index) => {
      const rowNumber = index + 2; // header is row 1
      const name = String(record[columnMap.name!] ?? '').trim();
      if (!name) {
        return; // silently skip fully blank rows
      }
      const price = columnMap.price ? parsePrice(record[columnMap.price]) : null;
      if (price === null) {
        errors.push(`Row ${rowNumber}: missing or invalid price for "${name}"`);
        return;
      }
      const explicitCategory = columnMap.category
        ? String(record[columnMap.category] ?? '').trim() || null
        : null;
      const stockQty = columnMap.stock ? parseStock(record[columnMap.stock]) : 0;
      const unit = columnMap.unit ? String(record[columnMap.unit] ?? '').trim() || 'pcs' : 'pcs';

      rawRows.push({ rowNumber, name, price, stockQty, unit, explicitCategory });
    });

    if (rawRows.length === 0) {
      throw new BadRequestException('No valid rows found in the file');
    }

    const existingCategories = await this.categoryModel.find({ shopId }).select('name').exec();
    const existingNames = existingCategories.map((category) => category.name);

    const needsInference = rawRows.filter((row) => !row.explicitCategory);
    let inferred = new Map<string, string>();
    if (needsInference.length > 0) {
      inferred = await this.inferCategories(
        needsInference.map((row) => row.name),
        existingNames,
      );
    }

    const seenNames = new Set(existingNames.map((name) => name.toLowerCase()));
    const rows: PreviewRow[] = rawRows.map((row) => {
      const categoryName = (row.explicitCategory ?? inferred.get(row.name) ?? 'Разное').trim();
      const categoryIsNew = !seenNames.has(categoryName.toLowerCase());
      seenNames.add(categoryName.toLowerCase());
      return {
        name: row.name,
        price: row.price,
        priceType: 'fixed',
        unit: row.unit,
        stockQty: row.stockQty,
        categoryName,
        categoryIsNew,
      };
    });

    return { rows, errors, aiUsed: needsInference.length > 0 };
  }

  private async inferCategories(
    names: string[],
    existingCategoryNames: string[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (let i = 0; i < names.length; i += AI_BATCH_SIZE) {
      const batch = names.slice(i, i + AI_BATCH_SIZE);
      const batchResult = await this.inferCategoryBatch(batch, existingCategoryNames);
      for (const [name, category] of batchResult) {
        result.set(name, category);
      }
    }

    return result;
  }

  private async inferCategoryBatch(
    names: string[],
    existingCategoryNames: string[],
  ): Promise<Map<string, string>> {
    const ResultSchema = z.object({
      results: z.array(
        z.object({
          name: z.string(),
          category: z.string(),
        }),
      ),
    });

    try {
      const response = await this.client.messages.parse({
        model: INFERENCE_MODEL,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: [
              'You categorize retail products for a small shop based on their name.',
              'Prefer reusing one of the existing categories below when it genuinely fits.',
              'Only propose a new category name when nothing existing fits - keep new names short (1-2 words), in the same language as the product names, and in Title Case.',
              'Return exactly one result per input name, in the same order, using the exact name text given.',
              '',
              'Existing categories:',
              existingCategoryNames.length > 0 ? existingCategoryNames.join(', ') : '(none yet)',
            ].join('\n'),
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Categorize these products:\n${names.map((name) => `- ${name}`).join('\n')}`,
          },
        ],
        output_config: { format: zodOutputFormat(ResultSchema) },
      });

      const map = new Map<string, string>();
      if (response.parsed_output) {
        for (const entry of response.parsed_output.results) {
          map.set(entry.name, entry.category);
        }
      }
      // Any name the model dropped falls back to a generic bucket.
      for (const name of names) {
        if (!map.has(name)) {
          map.set(name, 'Разное');
        }
      }
      return map;
    } catch (error) {
      this.logger.warn(`Category inference failed, falling back to a generic category: ${error}`);
      return new Map(names.map((name) => [name, 'Разное']));
    }
  }

  async commit(
    rows: CommitImportRowDto[],
    shopId: Types.ObjectId,
  ): Promise<{ createdProducts: number; createdCategories: number }> {
    const uniqueCategoryNames = [...new Set(rows.map((row) => row.categoryName.trim()))];

    const existingCategories = await this.categoryModel.find({ shopId }).exec();
    const categoryIdByLowerName = new Map(
      existingCategories.map((category) => [category.name.toLowerCase(), category._id]),
    );

    let createdCategories = 0;
    for (const name of uniqueCategoryNames) {
      if (!categoryIdByLowerName.has(name.toLowerCase())) {
        const created = await this.categoryModel.create({ shopId, name });
        categoryIdByLowerName.set(name.toLowerCase(), created._id);
        createdCategories += 1;
      }
    }

    const productDocs = rows.map((row) => ({
      shopId,
      name: row.name,
      categoryId: categoryIdByLowerName.get(row.categoryName.trim().toLowerCase()),
      priceType: row.priceType,
      price: row.price,
      unit: row.unit ?? 'pcs',
      stockQty: row.stockQty ?? 0,
    }));

    const created = await this.productModel.insertMany(productDocs);
    return { createdProducts: created.length, createdCategories };
  }
}
