import type { BoxKind } from '@/domain/entities/PackageEntity';

/**
 * 포장 절약 (FEATURE_2609_41 / PLAN 2609_41 S1 · S7 · S10 · S12 · S13 · S16, 백엔드 01 SSOT).
 *
 * 백엔드 `com.pms.dto.response.PackingSavingsSummary` · `PackingSavingsOptionRow` ·
 * `PackingSavingsBoxRow` 와 1:1 이다.
 *
 * 🔴 <b>기준일이 매출과 다르다.</b> 여기는 <b>포장 완료일</b>이고 매출 화면은 <b>주문일</b>이다(S7).
 * 같은 기간을 골라도 두 숫자가 덮는 주문이 다르다 — 화면이 이 차이를 한 줄로 밝혀야 한다
 * (`SAVINGS_BASIS_NOTICE`). 🔴 문구에 「매출 인식일」을 쓰지 말 것: 매출 화면이 자르는 축은 주문일이다.
 *
 * 🔴 <b>「절약 0」과 「기록 없음」은 다른 상태다</b>(S1). 포장 화면을 거치지 않은 주문은 <b>행 자체가 없다</b> —
 * 화면은 그 상품을 `0원` 이 아니라 `—` 로 그린다. 0 으로 그리면 "절약을 못 했다"로 읽히지만
 * 실제로는 "측정하지 않았다"다.
 *
 * 🔴 <b>채널 축이 없다</b>(S13). 포장은 창고 행위라 채널로 나눌 수 없다 — 상품별 손익 표가 채널별로
 * 쪼개진 보기에서는 절약 열을 통째로 `—` 로 둔다. 같은 절약을 채널 행마다 반복하면 합계가 부풀어 보인다.
 */

/** ① 전체 합계. `GET /api/admin/packing/savings/summary` */
export interface SavingsSummary {
  /** 집계에 들어간 박스 수(= 계산 근거가 있는 포장 완료 박스). */
  parcelCount: number;
  boxSaving: number;
  /** 무료배송 박스에서만 난다. 유료배송은 0, 배송비를 모르는 박스는 빠져 있다(S3). */
  deliverySaving: number;
  totalSaving: number;
  recycledParcelCount: number;
  recycledSaving: number;
  consolidatedParcelCount: number;
  consolidatedSaving: number;
  /** 계산 근거가 없어 <b>통째로 빠진</b> 박스 수(S14). 0 이면 화면에 안내를 띄우지 않는다. */
  missingBasisCount: number;
  /** 절약이 음수인 박스 수 — 합계에 그대로 들어 있다(S12). */
  negativeParcelCount: number;
  /** 실린 배송비를 몰라 <b>택배 절약만</b> 빠진 박스 수(S3). 🔴 그 박스의 상자 절약은 합계에 남아 있다. */
  missingShippingFeeCount: number;
}

/**
 * ② 옵션별 한 줄. `GET /api/admin/packing/savings/options`
 *
 * 🔴 행의 키는 <b>마스터 옵션</b>이다. 화면은 이 행들을 `masterProductId` 로 묶어 마스터 행에 합계를
 * 보이고, 펼쳤을 때만 옵션별로 내린다(S16) — 손익 표의 행이 마스터 단위이기 때문이다.
 */
export interface OptionSaving {
  /** 마스터가 끊긴 방어적 null. 화면은 이 행을 어느 상품에도 붙일 수 없다. */
  masterProductId: number | null;
  masterProductName: string | null;
  masterOptionId: number | null;
  masterOptionName: string | null;
  /** 🔴 이 옵션이 담긴 박스 수. 행끼리 더하면 전체 박스 수보다 커진다(한 박스에 여러 옵션이 담긴다). */
  parcelCount: number;
  boxSaving: number;
  deliverySaving: number;
  totalSaving: number;
}

/** ③ 상자별 한 줄. `GET /api/admin/packing/savings/boxes` — 치수·사진이 함께 온다(상자 목록을 따로 부르지 않는다). */
export interface BoxSaving {
  packageId: number;
  type: string;
  boxKind: BoxKind;
  /** 0 = 치수 미지정. `BoxShape` 가 점선 도형으로 그린다. */
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  /** 없으면 `BoxShape` 도형을 그린다(2609_40 D26). */
  imageUrl: string | null;
  parcelCount: number;
  boxSaving: number;
  deliverySaving: number;
  totalSaving: number;
}

/** 한 마스터 상품으로 접은 절약 (S16). 손익 표의 마스터 행이 이 값을 그린다. */
export interface MasterSaving {
  masterProductId: number;
  totalSaving: number;
  /** 🔴 옵션 행의 단순 합이다 — 한 박스에 같은 상품의 옵션이 여러 개 담기면 중복해 센다. */
  parcelCount: number;
  /** 펼쳤을 때 내려오는 옵션 행. 합계는 위 `totalSaving` 과 정확히 같다. */
  options: OptionSaving[];
}

/**
 * 옵션 행을 마스터로 접는다 (S16).
 *
 * 🔴 마스터가 없는 행은 버린다 — 붙일 상품 행이 없다. 합계는 요약 카드가 서버 값 그대로 보여주므로
 * 화면에서 다시 더하지 않는다.
 */
export const groupSavingsByMaster = (rows: OptionSaving[]): Map<number, MasterSaving> => {
  const grouped = new Map<number, MasterSaving>();
  rows.forEach((row) => {
    if (row.masterProductId == null) return;
    const found = grouped.get(row.masterProductId);
    const target =
      found ??
      { masterProductId: row.masterProductId, totalSaving: 0, parcelCount: 0, options: [] };
    target.totalSaving += row.totalSaving;
    target.parcelCount += row.parcelCount;
    target.options.push(row);
    if (!found) grouped.set(row.masterProductId, target);
  });
  return grouped;
};

/**
 * 절약 금액 표시. 🔴 `null`/`undefined` = <b>포장 기록 없음</b>이라 `—` 다(S1) — `0원` 과 다른 상태다.
 *
 * 음수는 그대로 보여준다(S12 — 상자를 비싸게 쓴 것). 색은 `savingToneClass` 가 준다.
 */
export const formatSaving = (value: number | null | undefined): string =>
  value == null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`;

/** 음수 절약만 빨강. 0 과 양수는 본문색이다(0 은 문제가 아니라 "그 기간엔 차이가 없었다"다). */
export const savingToneClass = (value: number | null | undefined): string => {
  if (value == null) return 'text-gray-400';
  return value < 0 ? 'text-red-600' : 'text-gray-900';
};

/** 박스 수 표시. 기록이 없으면 금액과 같은 `—` 다. */
export const formatParcelCount = (value: number | null | undefined): string =>
  value == null ? '—' : value.toLocaleString('ko-KR');

/** 🔴 기준일이 매출과 다르다는 사실을 화면에서 한 줄로 밝힌다(S7). 지우지 말 것. */
export const SAVINGS_BASIS_NOTICE =
  '포장한 날 기준입니다. 같은 화면의 매출은 주문일 기준이라 기간이 덮는 주문이 다릅니다.';

/** 🔴 순이익이 `—` 인 행이 섞여 있으므로 「순이익이 계산된 상품에 한해」로 한정한다(S6). */
export const SAVINGS_PROFIT_NOTICE =
  '순이익이 계산된 상품에 한해, 이 금액만큼 추정 순이익에 더해집니다. 지금 손익 화면은 옵션마다 상자·택배가 든다고 가정합니다.';

/** 🔴 재활용과 합포장은 겹칠 수 있다 — 둘을 더한 값을 어디에도 쓰지 않는다(S10). */
export const SAVINGS_OVERLAP_NOTICE = '일부 박스는 재활용과 합포장 양쪽에 모두 해당합니다.';

/** 절약 열이 비어 있는 이유를 셀 툴팁으로 설명한다(S1). */
export const SAVINGS_NO_RECORD_HINT = '포장 화면을 거치지 않은 주문입니다';

/** 🔴 채널별 보기에서 절약을 내지 않는 이유(S13). 표 위에 한 줄로 밝힌다. */
export const SAVINGS_CHANNEL_NOTICE =
  '포장 절약은 채널과 무관해 채널별 보기에서는 표시하지 않습니다.';
