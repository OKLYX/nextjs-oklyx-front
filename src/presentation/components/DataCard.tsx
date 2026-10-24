'use client';

import { createContext, useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ViewModeToggle } from '@/presentation/components/ViewModeToggle';
import { useShowCards } from '@/presentation/hooks/useShowCards';

/**
 * Card shape of the narrow-screen list cards (FEATURE_2610_31 D25) — one value picked in code, the web copy of the
 * mobile app's `kAppCardStyle` (`flutter-oklyx-mobile/lib/shared/widgets/app_card.dart`). The red failure boxes of
 * the order detail (D27) are not list cards and do not follow it.
 *
 * - `flat`: a page list runs to both screen edges, square corners, no shadow, one divider line between cards.
 * - `floating`: rounded corners, a shadow, 8px between cards, as wide as the place it sits in.
 *
 * Lists inside a popup or inside another list row are always `floating` (`DataCardList placement="nested"`).
 * ⚠️ Not a user setting or a server value. When the app changes `kAppCardStyle`, change this one line.
 */
export const CARD_STYLE: CardStyle = 'flat';

/** The two card shapes `CARD_STYLE` can pick. */
export type CardStyle = 'flat' | 'floating';

/** One `label: value` row of a card. */
export interface DataCardField {
  label: string;
  value: ReactNode;
}

/** Selection checkbox at the top-left of a card (a table's row checkbox). */
export interface DataCardSelection {
  checked: boolean;
  onChange: () => void;
  /** Screen-reader label of the checkbox. */
  label: string;
  disabled?: boolean;
}

/** true = the cards of the surrounding `DataCardList` are `flat`. */
const FlatCardContext = createContext(false);

interface DataCardListProps {
  /**
   * `page` = the list sits in the page body or in a titled box of the page (D25 · D30) — follows `CARD_STYLE`.
   * `nested` = the list sits in a popup or inside another list row — always `floating`.
   */
  placement: 'page' | 'nested';
  /** Extra classes of the list element (a height limit with its own scroll, `max-h-72 overflow-y-auto`). */
  className?: string;
  children: ReactNode;
}

/**
 * Wrapper of a narrow-screen card list (FEATURE_2610_31 D25 · D30).
 *
 * **Purpose**: owns the gap between cards and the width of the list, so every list draws the same shape.
 * **File**: src/presentation/components/DataCard.tsx
 *
 * **Usage**:
 * ```tsx
 * // A page list (body or a titled box of the page): edge to edge when CARD_STYLE = 'flat'.
 * <DataCardList placement="page">
 *   {rows.map((row) => <DataCard key={row.id} title={row.name} />)}
 * </DataCardList>
 *
 * // A list in a popup or inside another list row.
 * <DataCardList placement="nested">{cards}</DataCardList>
 * ```
 *
 * ⚠️ `flat` pulls the list 16px out on each side (`-mx-4`) — the page body padding (`main` `p-4`) below 768px.
 * ❌ Do not wrap the list in a white box in card view — `TableCard` (`renderCards`) and `DataCardSwitch` leave it
 *    out; a titled `Card` box takes `bare`.
 */
export function DataCardList({ placement, className, children }: DataCardListProps) {
  const flat = placement === 'page' && CARD_STYLE === 'flat';
  return (
    <FlatCardContext.Provider value={flat}>
      <div className={`${flat ? '-mx-4 divide-y divide-gray-200' : 'space-y-2'} ${className ?? ''}`}>{children}</div>
    </FlatCardContext.Provider>
  );
}

interface DataCardSwitchProps {
  /** Where the list sits — passed to `DataCardList`. */
  placement: 'page' | 'nested';
  /** The `DataCard`s of the rows, drawn in card view only. */
  renderCards: () => ReactNode;
  /** Class of the element that wraps the table (the element this component replaces). */
  className?: string;
  /** Class of the card list in card view — the wrapper's height limit and scroll (`max-h-64 overflow-y-auto`). */
  listClassName?: string;
  /**
   * false while the list is loading, empty or failed — the wrapped content (spinner, empty row, error) is drawn as
   * it is even in card view. Default true.
   */
  ready?: boolean;
  /** Controls above the cards, left of the switch, in card view only (「전체 선택」 · sort — D13 · D31). */
  cardsToolbar?: ReactNode;
  /** The table. */
  children: ReactNode;
}

/**
 * Table ↔ cards switch of a list that is not in a `TableCard` (FEATURE_2610_31 D13).
 *
 * **Purpose**: below 768px a table/card switch (`ViewModeToggle`) sits above the list; in card view the cards are
 * drawn instead of the table, at 768px and up the table always.
 * **File**: src/presentation/components/DataCard.tsx
 *
 * **Usage** — it takes the place of the element that wraps the table:
 * ```tsx
 * <DataCardSwitch
 *   placement="nested"
 *   className="overflow-x-auto"
 *   renderCards={() => rows.map((row) => <DataCard key={row.id} title={row.name} />)}
 * >
 *   <table>…</table>
 * </DataCardSwitch>
 * ```
 *
 * ⚠️ A list in a `TableCard` passes `renderCards` to `TableCard` instead.
 */
export function DataCardSwitch({
  placement,
  renderCards,
  className,
  listClassName,
  ready = true,
  cardsToolbar,
  children,
}: DataCardSwitchProps) {
  const showCards = useShowCards() && ready;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {showCards && cardsToolbar}
        <ViewModeToggle className="ml-auto" />
      </div>
      {showCards ? (
        <DataCardList placement={placement} className={listClassName}>
          {renderCards()}
        </DataCardList>
      ) : (
        <div className={className}>{children}</div>
      )}
    </>
  );
}

interface DataCardProps {
  /** Photo slot, left of the text column. */
  image?: ReactNode;
  /** Bold text at the start of the title row. */
  title?: ReactNode;
  /** Items right after the title on the same row (badges, small buttons) — they wrap with the title. */
  badges?: ReactNode;
  /** Items at the right end of the title row (a badge the app card pushes to the right). */
  trailing?: ReactNode;
  /** Text lines under the title row (the app card's text, labels inside the text). */
  body?: ReactNode;
  /** `label` left · `value` right rows — the cards of the lists the app does not have (D22). */
  fields?: DataCardField[];
  /**
   * One-line `label: value` rows in small text at the bottom of the text column (D37). A row whose value is
   * `null`, `undefined` or `''` is not drawn.
   */
  extraFields?: DataCardField[];
  /** Checkbox at the top-left. */
  selection?: DataCardSelection;
  /** Button row at the bottom of the card. A tap here does not reach `onClick`. */
  actions?: ReactNode;
  /** Expansion inside the card, under the button row (D33). A tap here does not reach `onClick`. */
  expansion?: ReactNode;
  /** Tap on the card (row tap → detail). Adds the button role and Enter · Space. */
  onClick?: () => void;
  /** true = the picked row (the table's highlighted row) — light blue background. */
  selected?: boolean;
  /** true = a row the table draws on a gray background (e.g. a line not matched to an order) — light gray background. */
  muted?: boolean;
  className?: string;
}

const stopTap = (event: MouseEvent) => event.stopPropagation();

/**
 * One row of a list as a card below 768px (FEATURE_2610_31 D13 · D24 · D25).
 *
 * **Purpose**: a table row becomes this card on a narrow screen. The card takes its parts as props — photo,
 * title row (title + badges, right-end items), text lines, `label: value` rows, checkbox, button row, expansion — and leaves out
 * the parts it does not get.
 * **File**: src/presentation/components/DataCard.tsx
 * **Rule**: a narrow-screen list card is this component inside a `DataCardList` — the one exception is the red
 * failure boxes of the order detail (D27). Do not build a card with a plain div.
 *
 * **Usage**:
 * ```tsx
 * // A list the app has (D14 · D24): the app card's photo, title, badges and text lines.
 * <DataCard
 *   image={<ProductThumb id={order.productId} />}
 *   title={order.externalOrderId}
 *   badges={<StageBadge stage={order.stage} />}
 *   body={<p className="text-[13px] text-gray-500">고객 {order.customerName}</p>}
 *   extraFields={[{ label: '결제일', value: formatDate(order.paidAt) }]}
 *   onClick={() => openDetail(order.id)}
 * />
 *
 * // A list the app does not have (D22): every table column as `label` · `value`, buttons in the button row.
 * <DataCard
 *   fields={[
 *     { label: '이름', value: row.name },
 *     { label: '금액', value: formatKrw(row.amount) },
 *   ]}
 *   actions={<Button size="sm" onClick={() => edit(row)}>수정</Button>}
 * />
 *
 * // A row with a checkbox.
 * <DataCard selection={{ checked, onChange: () => toggle(row.id), label: `${row.name} 선택` }} title={row.name} />
 * ```
 *
 * ⚠️ Shape (corners, shadow, gap) comes from `CARD_STYLE` through `DataCardList` — the card never takes it.
 * ⚠️ A button inside `badges` or `body` must stop its own click (`event.stopPropagation()`), or the tap also
 *    opens the card. `actions` and `expansion` stop it for you.
 * ⚠️ Colours = the `bg-white` · `text-gray-*` · `border-gray-*` tokens (dark mode is mapped globally).
 * ❌ Do not write a different card structure per list · no hex colours · no per-card `dark:` variants.
 */
export function DataCard({
  image,
  title,
  badges,
  trailing,
  body,
  fields,
  extraFields,
  selection,
  actions,
  expansion,
  onClick,
  selected = false,
  muted = false,
  className,
}: DataCardProps) {
  const flat = useContext(FlatCardContext);
  const clickable = typeof onClick === 'function';
  const background = selected ? 'bg-blue-50' : muted ? 'bg-gray-50' : 'bg-white';
  const shape = flat ? background : `rounded-lg ${background} shadow`;
  const hasTitleRow = title !== undefined || badges !== undefined || trailing !== undefined;
  const shownExtraFields = (extraFields ?? []).filter((field) => field.value != null && field.value !== '');

  const onKeyDown = clickable
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        // Keys typed into an input inside the card belong to that input.
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={onKeyDown}
      className={`${shape} p-3 ${clickable ? 'cursor-pointer transition-colors hover:bg-gray-50' : ''} ${className ?? ''}`}
    >
      <div className="flex items-start gap-3">
        {selection && (
          <input
            type="checkbox"
            aria-label={selection.label}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
            checked={selection.checked}
            disabled={selection.disabled}
            onClick={stopTap}
            onChange={selection.onChange}
          />
        )}
        {image !== undefined && <div className="shrink-0">{image}</div>}
        <div className="min-w-0 flex-1 space-y-1.5">
          {hasTitleRow && (
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                {title !== undefined && <span className="text-sm font-bold text-gray-900">{title}</span>}
                {badges}
              </div>
              {trailing !== undefined && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
            </div>
          )}
          {body}
          {fields && fields.length > 0 && (
            <dl className="space-y-1.5">
              {fields.map((field, index) => (
                <div key={index} className="flex items-start justify-between gap-3">
                  <dt className="shrink-0 text-xs font-medium text-gray-500">{field.label}</dt>
                  <dd className="min-w-0 text-right text-sm text-gray-900">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {shownExtraFields.length > 0 && (
            <dl className="space-y-0.5">
              {shownExtraFields.map((field, index) => (
                <div key={index} className="text-xs text-gray-500">
                  <dt className="inline">{field.label}: </dt>
                  <dd className="inline">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {actions !== undefined && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2" onClick={stopTap}>
          {actions}
        </div>
      )}
      {expansion !== undefined && (
        <div className="mt-3" onClick={stopTap}>
          {expansion}
        </div>
      )}
    </div>
  );
}
