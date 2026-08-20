import { ProcessingPresetEditor } from '../components/ProcessingPresetEditor';

export default async function ProcessingPresetEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProcessingPresetEditor presetId={Number(id)} />;
}
