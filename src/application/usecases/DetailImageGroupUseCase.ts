import type { DetailImageGroupRepository } from '@/domain/repositories/DetailImageGroupRepository';
import type { DetailImageGroup } from '@/domain/entities/DetailImageGroupEntity';

/**
 * 상세 이미지 그룹 카탈로그 usecase (FEATURE_2609_03).
 * 얇은 위임만 — 로직을 넣지 말 것.
 */
export class DetailImageGroupUseCase {
  constructor(private repository: DetailImageGroupRepository) {}

  list(): Promise<DetailImageGroup[]> {
    return this.repository.list();
  }

  create(name: string): Promise<DetailImageGroup> {
    return this.repository.create(name);
  }

  rename(id: number, name: string): Promise<DetailImageGroup> {
    return this.repository.rename(id, name);
  }

  remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }
}
