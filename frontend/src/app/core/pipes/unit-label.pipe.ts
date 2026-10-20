import { Pipe, PipeTransform } from '@angular/core';

const UNIT_LABEL_KEYS: Record<string, string> = {
  pcs: 'admin.products.unitPcs',
  pack: 'admin.products.unitPack',
  box: 'admin.products.unitBox',
  bottle: 'admin.products.unitBottle',
  kg: 'admin.products.unitKg',
  l: 'admin.products.unitL',
};

// Products/cart/transactions store the unit as an English code (pcs, bottle, kg...).
// Maps it to a translation key for display - legacy/custom values fall through
// unchanged, since there's no key for them to translate.
@Pipe({ name: 'unitLabel', standalone: true, pure: true })
export class UnitLabelPipe implements PipeTransform {
  transform(unit: string | null | undefined): string {
    if (!unit) {
      return '';
    }
    return UNIT_LABEL_KEYS[unit] ?? unit;
  }
}
