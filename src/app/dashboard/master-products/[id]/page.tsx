import { CoverageMatrix } from './components/CoverageMatrix';

interface MasterProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MasterProductDetailPage({ params }: MasterProductDetailPageProps) {
  const { id } = await params;
  return <CoverageMatrix id={id} />;
}
