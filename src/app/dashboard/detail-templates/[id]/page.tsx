import { DetailTemplateEditor } from '../components/DetailTemplateEditor';

export default async function DetailTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailTemplateEditor templateId={Number(id)} />;
}
