import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const filePath = resolve('/app/uploads', ...path);

    const data = await readFile(filePath);

    const contentType = filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
      ? 'image/jpeg'
      : filePath.endsWith('.png')
        ? 'image/png'
        : 'application/octet-stream';

    return new NextResponse(data, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
