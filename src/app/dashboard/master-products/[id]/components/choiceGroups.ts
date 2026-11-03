import type { CategoryAttribute } from '@/domain/entities/MasterProductEntity';
import { isOptionField } from './optionMetaFields';

/**
 * Coupang one-of groups (`groupNumber`) of the category required attributes (FEATURE_2611_08 / D2 · R1 · R2).
 *
 * **Purpose**: the only place that computes the choice groups and their guide texts. The save checks
 * (`categoryMetaValidation.ts`) and both field panels (`CategoryMetaFields` master side ·
 * `CategoryMetaOverrideFields` option side) call this.
 * **File**: src/app/dashboard/master-products/[id]/components/choiceGroups.ts
 * **Rule**: same as the server (`CoupangListingAdapter.validateRegistrable`) — required attributes sharing one
 * `groupNumber` are satisfied by any one of them; a required attribute without a group number is required on its
 * own. Optional attributes never join a group, even when they carry a number.
 *
 * **Usage**:
 * ```ts
 * const groups = requiredChoiceGroups(attributes);
 * const blocked = groups.some((g) => !isOptionGroup(g) && !isGroupFilled(g, (n) => (values[n] ?? '').trim()));
 * ```
 * ```tsx
 * // Box header above the grouped fields
 * <p><span className="text-red-600">* </span>{choiceGroupGuide(g)}</p>
 * ```
 *
 * ⚠️ A group with at least one option-owned member (`isOptionField`) is checked by the option save check only —
 * with the master value as fallback (D3 · D5).
 * ❌ Do not infer a group from attribute names (weight/volume pairs are for display and auto-fill only).
 * ❌ Do not write a second group count or guide text elsewhere — call these.
 */
export interface ChoiceGroup {
  groupNumber: string;
  members: CategoryAttribute[]; // required members of this number, in schema order
}

/** The group number that counts for the one-of rule — '' for optional attributes or no number (R1). */
export function requiredGroupNumber(a: CategoryAttribute): string {
  return a.required ? (a.groupNumber ?? '').trim() : '';
}

/** Required attributes grouped by number; groups are ordered by where their first member appears. */
export function requiredChoiceGroups(attributes: CategoryAttribute[]): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  const byNumber = new Map<string, ChoiceGroup>();
  for (const a of attributes) {
    const n = requiredGroupNumber(a);
    if (!n) continue;
    let g = byNumber.get(n);
    if (!g) {
      g = { groupNumber: n, members: [] };
      byNumber.set(n, g);
      groups.push(g);
    }
    g.members.push(a);
  }
  return groups;
}

/** A group with any option-owned member — checked by the option save check (D5). */
export function isOptionGroup(g: ChoiceGroup): boolean {
  return g.members.some((m) => isOptionField(m.name));
}

/** True when any member has a value. `valueOf` returns the trimmed value ('' = empty). */
export function isGroupFilled(g: ChoiceGroup, valueOf: (name: string) => string): boolean {
  return g.members.some((m) => valueOf(m.name) !== '');
}

/** Box header text (D8). In an option group the master-owned members get the 「(상품 기본 정보)」 suffix. */
export function choiceGroupGuide(g: ChoiceGroup): string {
  const optionGroup = isOptionGroup(g);
  const names = g.members.map((m) =>
    optionGroup && !isOptionField(m.name) ? `${m.name}(상품 기본 정보)` : m.name,
  );
  return `${names.join(' · ')} 중 하나만 넣으면 됩니다`;
}

/** Note under a master-owned member of an option group (D9 · D12). */
export function optionGroupMasterNote(g: ChoiceGroup): string {
  const names = g.members.filter((m) => isOptionField(m.name)).map((m) => m.name);
  return `옵션에서 ${names.join(' · ')}을 넣으면 비워도 됩니다`;
}
