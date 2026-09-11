import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 팝업을 손으로 짜지 못하게 막는 규칙.
 *
 * `ui/Modal` 이 백드롭·3영역 레이아웃·닫기 경로·작성 중 확인·z-index·접근성을 전부 소유한다.
 * 호출부가 백드롭을 새로 그리면 그 팝업만 조용히 그 보호를 잃는다(특히 **작성 중 닫기 확인**은
 * Modal 이 자동으로 해주는 것이라, 손으로 짠 팝업은 입력을 말없이 버린다).
 *
 * 2026-09-12 기준 위반 0건이다. 새로 늘리지 말 것.
 */
const HAND_ROLLED_POPUP = [
  {
    selector: 'JSXAttribute[name.name="className"] Literal[value=/fixed\\s+inset-0/]',
    message:
      '팝업 백드롭을 직접 작성하지 마세요. `ui/Modal` 을 쓰면 백드롭·헤더/푸터 고정·본문 스크롤·' +
      '작성 중 닫기 확인을 전부 가져갑니다.',
  },
  {
    selector: 'JSXAttribute[name.name="className"] TemplateElement[value.raw=/fixed\\s+inset-0/]',
    message:
      '팝업 백드롭을 직접 작성하지 마세요. `ui/Modal` 을 쓰면 백드롭·헤더/푸터 고정·본문 스크롤·' +
      '작성 중 닫기 확인을 전부 가져갑니다.',
  },
  {
    selector: 'JSXAttribute[name.name="className"] Literal[value=/\\bz-50\\b|z-\\[60\\]/]',
    message: '팝업 z-index 를 직접 쓰지 마세요. 층은 `ui/Modal` 이 소유합니다 — `nested` 만 넘기세요.',
  },
  {
    selector: 'ImportDeclaration[source.value=/^@radix-ui/]',
    message:
      'Radix 를 호출부에서 직접 import 하지 마세요. `ui/Modal` 한 곳에만 두어야 나중에 교체할 수 있습니다.',
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['error', ...HAND_ROLLED_POPUP] },
  },
  {
    // 예외 3곳. 늘리기 전에 정말 팝업이 아닌지 확인할 것.
    //  - ui/Modal.tsx      : 규칙이 지키려는 대상 본인
    //  - dashboard/layout.tsx : 좁은 화면 사이드바 드로어(팝업 아님)
    //  - EnvBadge.tsx      : 화면 구석 고정 배지(팝업 아님)
    files: [
      'src/presentation/components/ui/Modal.tsx',
      'src/app/dashboard/layout.tsx',
      'src/presentation/components/EnvBadge.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
