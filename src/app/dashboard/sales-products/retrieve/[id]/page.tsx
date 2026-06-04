import { ProductListingDetailsContainer } from './components/ProductListingDetailsContainer';

interface ProductListingDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductListingDetailsPage({ params }: ProductListingDetailsPageProps) {
  const { id } = await params;
  return <ProductListingDetailsContainer id={id} />;
}
