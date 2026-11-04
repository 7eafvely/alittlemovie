import { NextResponse } from 'next/server';
import { getImageProvider, MAX_PROMPT_LENGTH } from '@/lib/providers/image';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return NextResponse.json({ error: '定妆图提示词不能为空。' }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `提示词不能超过 ${MAX_PROMPT_LENGTH} 个字符。` }, { status: 400 });

    const provider = getImageProvider();
    const result = await provider.generate({ prompt });
    return NextResponse.json({ imageUrls: result.imageUrls, id: result.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求格式无效或暂时无法连接图片服务，请稍后重试。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
