import { ProductListingEditSinglePageForm } from '../components/ProductListingEditSinglePageForm';

interface SalesProductsEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SalesProductsEditPage({ params }: SalesProductsEditPageProps) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-white">
      <ProductListingEditSinglePageForm listingId={id} />
    </div>
  );
}
