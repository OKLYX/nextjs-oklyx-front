import type { PackingSavingsRepository } from '@/domain/repositories/PackingSavingsRepository';
import type {
  BoxSaving,
  OptionSaving,
  SavingsSummary,
} from '@/domain/entities/PackingSavingsEntity';
import type { PackingSavingsParams } from '@/application/dto/PackingSavingsDTOs';

/**
 * 포장 절약 유스케이스 (FEATURE_2609_41). 매출 요약 화면(카드·상자별)과 상품별 손익 표가 공유한다.
 *
 * ⚠️ 얇은 위임이다 — 접기·합치기 같은 표시 규칙은 도메인(`groupSavingsByMaster`)이 갖는다.
 */
export class PackingSavingsUseCase {
  constructor(private repository: PackingSavingsRepository) {}

  async getSummary(params: PackingSavingsParams): Promise<SavingsSummary> {
    return this.repository.getSummary(params);
  }

  async getOptions(params: PackingSavingsParams): Promise<OptionSaving[]> {
    return this.repository.getOptions(params);
  }

  async getBoxes(params: PackingSavingsParams): Promise<BoxSaving[]> {
    return this.repository.getBoxes(params);
  }
}
