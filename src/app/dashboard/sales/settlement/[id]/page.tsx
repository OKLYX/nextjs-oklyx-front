import { PayoutDetailContainer } from './components/PayoutDetailContainer';

interface SettlementPayoutDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettlementPayoutDetailPage({
  params,
}: SettlementPayoutDetailPageProps) {
  const { id } = await params;
  return <PayoutDetailContainer payoutId={Number(id)} />;
}
