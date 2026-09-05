import { NextRequest, NextResponse } from 'next/server';

/**
 * 상품 이미지 원본을 첨부파일로 내려주는 same-origin 다운로드 프록시.
 * File: src/app/api/image-download/route.ts
 *
 * **용도**: `ProductImageGallery` 의 [다운로드] 버튼이 사용한다.
 *
 * **왜 필요한가**: 갤러리 이미지는 퍼블릭 S3(교차 출처) URL 이라 `<a download>` 의
 * download 속성이 무시되고 "새 탭에서 열기"로 끝난다. 이 라우트를 거치면 same-origin +
 * `Content-Disposition: attachment` 가 되어 실제 파일 저장으로 동작한다.
 *
 * **사용 예제**:
 *   /api/image-download?url=https%3A%2F%2Fbucket.s3.ap-northeast-2.amazonaws.com%2Ftenants%2F1%2Fa.jpg
 *   /api/image-download?url=products%2F12%2Fa.jpg           (로컬 디스크 키 → uploads 프록시)
 *
 * ⚠️ SSRF 방지: http(s) 는 화이트리스트 호스트(*.amazonaws.com)만 허용한다.
 * ❌ 임의 외부 URL 프록시로 사용 금지.
 */
const ALLOWED_HOST_SUFFIX = '.amazonaws.com';

// Last path segment (query stripped) — the stored object key keeps the original name.
function fileNameFrom(source: string): string {
  const path = source.split('?')[0].replace(/\/+$/, '');
  const base = path.substring(path.lastIndexOf('/') + 1);
  return base || 'product-image';
}

// RFC 6266: ASCII fallback + UTF-8 form so Korean file names survive.
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let target: string;
  if (/^https?:\/\//i.test(raw)) {
    let hostname: string;
    try {
      hostname = new URL(raw).hostname;
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    if (!hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      return NextResponse.json({ error: 'Host not allowed' }, { status: 400 });
    }
    target = raw;
  } else {
    target = `${request.nextUrl.origin}/api/uploads/${raw.replace(/^\/+/, '')}`;
  }

  try {
    const upstream = await fetch(target, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: upstream.status });
    }

    const blob = await upstream.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': contentDisposition(fileNameFrom(raw)),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
