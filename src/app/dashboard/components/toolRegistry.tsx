'use client';

import type { ComponentType, ReactNode } from 'react';
import { Clipboard, Search } from 'lucide-react';
import type { ToolKey } from '@/infrastructure/stores/toolPanelStore';
import { ChannelProductTool } from './ChannelProductTool';
import { ClipboardRailSlot, ClipboardTool } from './ClipboardTool';

/**
 * 오른쪽 도구 **목록 한 곳** (FEATURE_2609_68 · 클립보드 편입으로 두 번째 도구가 생김).
 *
 * **용도**: 툴바 아이콘(`ToolRail`)과 패널 머리줄·본문(`ToolPanel`)이 같은 목록을 본다.
 * **파일**: src/app/dashboard/components/toolRegistry.tsx
 * **쓰는 곳**: `ToolRail` · `ToolPanel` 두 곳뿐이다. 화면에서 직접 읽지 않는다.
 *
 * 🔴 도구가 하나였을 때는 목록을 만들지 않았다(PLAN/D1). 클립보드가 툴바로 들어와 **둘이 되었으므로**
 *    그 결정을 여기서 번복한다 — 아이콘·이름·본문이 두 파일에 흩어지면 한쪽만 고치는 사고가 난다.
 * ❌ 플러그인·동적 로딩·탭 추상화로 키우지 말 것. 이 파일은 **배열 하나**로 끝낸다.
 *
 * **새 도구를 더할 때**: `toolPanelStore` 의 `ToolKey` 에 키를 더하고 여기 한 줄을 더한다.
 */
export interface DashboardTool {
  key: ToolKey;
  /** 툴바 툴팁 · 패널 머리줄 이름. */
  label: string;
  /** 툴바 아이콘(lucide). */
  Icon: ComponentType<{ size?: number | string; 'aria-hidden'?: boolean }>;
  /** 패널 본문. */
  Body: ComponentType;
  /**
   * 툴바 버튼을 감싸는 껍데기(선택). 배지·드롭존처럼 **버튼 위에 얹는 것**이 있을 때만 쓴다.
   * 없으면 `ToolRail` 이 평범한 버튼 하나만 그린다.
   */
  RailSlot?: ComponentType<{ children: ReactNode }>;
}

export const TOOLS: readonly DashboardTool[] = [
  {
    key: 'channel-product',
    label: '플랫폼 상품 조회',
    Icon: Search,
    Body: ChannelProductTool,
  },
  {
    key: 'clipboard',
    label: '클립보드',
    Icon: Clipboard,
    Body: ClipboardTool,
    RailSlot: ClipboardRailSlot,
  },
];

export const findTool = (key: ToolKey): DashboardTool | undefined =>
  TOOLS.find((tool) => tool.key === key);
