import { WideScreenOnly } from '@/presentation/components/WideScreenOnly';
import { CollageEditorContainer } from './components/CollageEditorContainer';

interface MasterCollagePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string; sellerId?: string; listingId?: string }>;
}

export default async function MasterCollagePage({ params, searchParams }: MasterCollagePageProps) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <WideScreenOnly backLabel="뒤로">
      <CollageEditorContainer
        id={id}
        stage={query.stage}
        sellerId={query.sellerId}
        listingId={query.listingId}
      />
    </WideScreenOnly>
  );
}
