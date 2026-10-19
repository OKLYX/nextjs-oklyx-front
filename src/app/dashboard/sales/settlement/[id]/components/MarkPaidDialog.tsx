'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { todayKst } from '@/domain/entities/Settlement';

/**
 * [지급 완료] on an 11st payout — picks the day the money actually arrived (FEATURE_2610_20 / D34 · D38).
 *
 * The date starts at `defaultDate` (the remittance date, or today when that is still ahead) and never passes today
 * (KST, D38 — the server refuses a later date too). Saving is the container's job (`onConfirm`); this dialog only
 * collects the date.
 * ⚠️ The container mounts it only while open, so the date starts over at every opening.
 */
interface MarkPaidDialogProps {
  /** `yyyy-MM-dd` — the remittance date (`settlementDate`), or today (KST) when that is still ahead. */
  defaultDate: string;
  saving: boolean;
  /** Save failure text. Empty = hidden. */
  error: string;
  onConfirm: (paidOn: string) => void;
  onClose: () => void;
}

export function MarkPaidDialog({ defaultDate, saving, error, onConfirm, onClose }: MarkPaidDialogProps) {
  const [paidOn, setPaidOn] = useState(defaultDate);
  const today = todayKst();

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="지급 완료"
      disableClose={saving}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={() => onConfirm(paidOn)}
            isLoading={saving}
            loadingText="저장 중..."
            disabled={paidOn === '' || paidOn > today}
          >
            지급 완료
          </Button>
        </>
      }
    >
      <Input
        type="date"
        label="실제 입금일"
        max={today}
        value={paidOn}
        onChange={(e) => setPaidOn(e.target.value)}
        disabled={saving}
        error={error || undefined}
      />
    </Modal>
  );
}
