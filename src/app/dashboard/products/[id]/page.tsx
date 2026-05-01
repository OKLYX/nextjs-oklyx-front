import { ProductDetailContainer } from './components/ProductDetailContainer';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailContainer id={Number(id)} />;
}
