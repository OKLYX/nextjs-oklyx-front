import type { StockDateEdit } from '@/domain/entities/StockLotEntity';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';

/**
 * The day corrections of one daily row, newest first (FEATURE_2611_21 D24), under the row popup and the
 * 「날짜 바꾸기」 window: 「{고친 시각} · {고친 사람} · {옛 날짜} → {새 날짜}」. Nothing is drawn for a row never corrected.
 */
export function DateEditHistory({ edits }: { edits: StockDateEdit[] }) {
  if (edits.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-700 mb-1">날짜 고친 이력</p>
      <ul className="space-y-1 text-xs text-gray-600">
        {edits.map((edit, index) => (
          <li key={index}>
            {formatKstWallClock(edit.editedAt)} · {edit.editedBy ?? '-'} · {edit.oldMovedOn} →{' '}
            {edit.newMovedOn}
          </li>
        ))}
      </ul>
    </div>
  );
}
