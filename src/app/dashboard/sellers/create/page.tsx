import { PageContainer } from '@/presentation/components/PageContainer';
import { SellerRegistrationForm } from './components/SellerRegistrationForm';

export default function SellerCreatePage() {
  return (
    <PageContainer width="sm">
      <SellerRegistrationForm />
    </PageContainer>
  );
}
