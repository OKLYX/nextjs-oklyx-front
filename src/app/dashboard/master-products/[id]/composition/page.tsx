import { MasterCompositionContainer } from './components/MasterCompositionContainer';

interface MasterCompositionPageProps {
  params: Promise<{ id: string }>;
}

export default async function MasterCompositionPage({ params }: MasterCompositionPageProps) {
  const { id } = await params;
  return <MasterCompositionContainer id={id} />;
}
