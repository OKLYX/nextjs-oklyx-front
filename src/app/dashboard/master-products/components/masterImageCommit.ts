import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { MasterImageBuffer } from './MasterImagePool';

/**
 * 생성 버퍼의 이미지를 방금 만들어진 마스터에 반영한다(FEATURE_2608_06 / 38 의 저장 순서).
 * File: src/app/dashboard/master-products/components/masterImageCommit.ts
 *
 * ⚠️ 파일 업로드는 **순차** 로 한다 — 서버가 업로드 순서를 그대로 풀 순서로 쓰므로 `Promise.all` 은
 * 순서를 깬다.
 *
 * ⚠️ `try/catch` 를 여기 두지 않는다 — 실패했을 때 띄울 안내 문구가 화면마다 다르다. 호출부가 감싼다.
 *
 * 🔴 **이 파일은 중복 제거가 아니라 확장 지점이다**(사용자 결정 2026-09-14). 이미지 선택·처리 도구는
 * 앞으로 계속 자란다(자동 보정·규격 검사·순서 규칙 등) — 그 변경이 **한 파일에서** 일어나야 생성
 * 입구가 몇 개로 늘어도 같은 규칙으로 저장된다. 새 입구를 만들 때도 이 헬퍼를 부른다.
 *
 * **호출부**:
 *   - 마스터 생성 폼 `MasterProductCreateForm`
 *   - 플랫폼 상품 생성 폼 `MasterFromChannelForm`
 *
 * @example
 * try {
 *   await commitMasterImageBuffer(detailUseCase, created.id, imageBuffer);
 * } catch {
 *   onCreatedWithWarning(created.id, '마스터·옵션은 생성되었습니다. 이미지 반영에 실패했습니다.');
 * }
 */
export async function commitMasterImageBuffer(
  detailUseCase: DetailContentUseCase,
  masterId: number,
  buffer: MasterImageBuffer,
): Promise<void> {
  // Buffer: upload pool files sequentially (index → real id) then apply mappings.
  // Sequential await preserves pool sortOrder (backend = upload order); Promise.all
  // would race it.
  const idByIndex: number[] = [];
  for (const file of buffer.files) {
    const uploaded = await detailUseCase.uploadPoolImage(masterId, file);
    idByIndex.push(uploaded.id);
  }
  // Import product-image references (create pool entries) → map productImageId to pool id.
  const poolIdByProductId = new Map<number, number>();
  const productIds = [...new Set(Object.values(buffer.productAssignments ?? {}).flat())];
  if (productIds.length > 0) {
    const refs = await detailUseCase.importProductImages(masterId, productIds);
    for (const r of refs) {
      if (r.productImageId != null) poolIdByProductId.set(r.productImageId, r.id);
    }
  }
  // Apply each field = uploaded file pool ids + imported product pool ids.
  const fieldKeys = new Set([
    ...Object.keys(buffer.assignments),
    ...Object.keys(buffer.productAssignments ?? {}),
  ]);
  for (const fieldKey of fieldKeys) {
    const fileIds = (buffer.assignments[fieldKey] ?? [])
      .map((i) => idByIndex[i])
      .filter((v): v is number => v != null);
    const productPoolIds = (buffer.productAssignments?.[fieldKey] ?? [])
      .map((id) => poolIdByProductId.get(id))
      .filter((v): v is number => v != null);
    const ids = [...fileIds, ...productPoolIds];
    if (fieldKey === SOURCE_ZONE) {
      await detailUseCase.setSourceImage(masterId, ids[0] ?? null);
    } else {
      await detailUseCase.setZoneImages(masterId, fieldKey, ids);
    }
  }
}
