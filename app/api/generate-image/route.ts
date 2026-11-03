import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json(
      { error: '访问码错误。' },
      { status: 401 }
    );
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'MINIMAX_API_KEY 未配置。' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空。' }, { status: 400 });
    }

    const response = await fetch('https://api.minimaxi.com/v1/image_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: '9:16',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const msg = data?.base_resp?.status_msg || '图片生成失败';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const imageUrl = data?.data?.image_urls?.[0];
    if (!imageUrl) {
      return NextResponse.json({ error: '图片生成未返回结果。' }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
