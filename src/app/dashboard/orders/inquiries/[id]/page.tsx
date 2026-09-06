import { InquiryDetailContainer } from './components/InquiryDetailContainer';

interface InquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InquiryDetailPage({ params }: InquiryDetailPageProps) {
  const { id } = await params;
  return <InquiryDetailContainer inquiryId={Number(id)} />;
}
