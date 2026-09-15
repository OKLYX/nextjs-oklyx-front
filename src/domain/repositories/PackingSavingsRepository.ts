import type {
  BoxSaving,
  OptionSaving,
  SavingsSummary,
} from '@/domain/entities/PackingSavingsEntity';
import type { PackingSavingsParams } from '@/application/dto/PackingSavingsDTOs';

/**
 * 포장 절약 조회 API (FEATURE_2609_41 / 백엔드 01). 전 경로가 `/api/admin/packing/savings/**` — ADMIN 전용.
 *
 * ⚠️ 전부 로컬 DB 집계라 마켓을 부르지 않는다. 화면이 자주 열려도 마켓 호출량이 되지 않는다.
 * 🔴 축은 <b>판매자·기간</b>뿐이다(PLAN 2609_41 S13) — 채널 파라미터를 더하지 말 것.
 */
export interface PackingSavingsRepository {
  /** ① 전체 합계 + 재활용·합포장·제외 건수. */
  getSummary(params: PackingSavingsParams): Promise<SavingsSummary>;
  /** ② 옵션별(키 = 마스터 옵션). 화면이 마스터로 접는다(S16). */
  getOptions(params: PackingSavingsParams): Promise<OptionSaving[]>;
  /** ③ 상자별. 치수·사진이 함께 와서 상자 그림을 바로 그린다. */
  getBoxes(params: PackingSavingsParams): Promise<BoxSaving[]>;
}
