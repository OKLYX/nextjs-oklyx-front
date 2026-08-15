import { TemplateEditor } from '../components/TemplateEditor';

export default async function ThumbnailTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TemplateEditor mode="edit" id={Number(id)} />;
}
