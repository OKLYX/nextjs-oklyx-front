import { ProductMergeContainer } from './components/ProductMergeContainer';

export default async function ProductMergePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductMergeContainer id={Number(id)} />;
}
