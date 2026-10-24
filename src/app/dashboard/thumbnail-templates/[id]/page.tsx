import { ROUTES } from '@/config/routes';
import { WideScreenOnly } from '@/presentation/components/WideScreenOnly';
import { TemplateEditor } from '../components/TemplateEditor';

export default async function ThumbnailTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WideScreenOnly backLabel="목록으로" backHref={ROUTES.THUMBNAIL_TEMPLATES}>
      <TemplateEditor mode="edit" id={Number(id)} />
    </WideScreenOnly>
  );
}
