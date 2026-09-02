import type { DetailImageGroup } from '@/domain/entities/DetailImageGroupEntity';

export interface DetailImageGroupRepository {
  list(): Promise<DetailImageGroup[]>;
  create(name: string): Promise<DetailImageGroup>;
  rename(id: number, name: string): Promise<DetailImageGroup>;
  remove(id: number): Promise<void>;
}
