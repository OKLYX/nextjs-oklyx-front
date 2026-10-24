import { ROUTES } from '@/config/routes';
import { WideScreenOnly } from '@/presentation/components/WideScreenOnly';
import { TemplateEditor } from '../components/TemplateEditor';

export default function ThumbnailTemplateNewPage() {
  return (
    <WideScreenOnly backLabel="목록으로" backHref={ROUTES.THUMBNAIL_TEMPLATES}>
      <TemplateEditor mode="new" />
    </WideScreenOnly>
  );
}
