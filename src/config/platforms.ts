/**
 * 셀(ProductListing)이 붙을 수 있는 마켓 플랫폼 목록.
 *
 * **용도**: 마진 프리셋·판매상품 수정 폼의 플랫폼 select 옵션
 * **위치**: src/config/platforms.ts
 * **이력**: 2609_24 이전에는 legacy 등록 폼(register/components/ProductListingForm.tsx:9)이
 *          소유했다. 그 화면이 사라지면서 설정으로 승격됐다.
 *
 * ⚠️ 실제 어댑터가 구현된 플랫폼은 COUPANG 뿐이다. 나머지 3개는 화면 선택지일 뿐
 *    등록·동기화가 동작하지 않는다 — 값을 늘리기 전에 어댑터부터 확인할 것.
 */
export const PLATFORMS = ['COUPANG', 'GMARKET', 'AUCTION', 'SMARTSTORE'];
