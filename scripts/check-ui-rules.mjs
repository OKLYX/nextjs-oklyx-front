/**
 * 팝업 규칙 위반만 골라 검사한다 (PR 게이트용).
 *
 * ⚠️ 전체 lint 가 아니다 — 이 저장소에는 이번 작업과 무관한 기존 error 9건이 있어서,
 * 전체 lint 를 게이트로 걸면 첫 PR 부터 빨갛게 뜬다. 그래서 `no-restricted-syntax`
 * (eslint.config.mjs 의 팝업 규칙) 위반만 실패 사유로 삼는다.
 *
 * 기존 부채를 정리한 뒤에는 이 스크립트를 지우고 전체 lint 를 게이트로 올리면 된다.
 */
import { ESLint } from 'eslint';

const RULE = 'no-restricted-syntax';

const eslint = new ESLint();
const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);

const hits = results.flatMap((r) =>
  r.messages
    .filter((m) => m.ruleId === RULE)
    .map((m) => ({ file: r.filePath.replace(`${process.cwd()}/`, ''), line: m.line, message: m.message })),
);

if (hits.length === 0) {
  console.log('✓ 팝업 규칙 위반 없음');
  process.exit(0);
}

console.error(`✗ 팝업 규칙 위반 ${hits.length}건\n`);
for (const h of hits) console.error(`  ${h.file}:${h.line}\n    ${h.message}\n`);
console.error('팝업은 `src/presentation/components/ui/Modal.tsx` 를 쓰세요.');
process.exit(1);
