import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.io';
const MAX_PROMPT_LENGTH = 1500;

export async function POST(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' }, { status: 401 });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return NextResponse.json({ error: '服务端尚未配置 MINIMAX_API_KEY。' }, { status: 503 });

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) return NextResponse.json({ error: '定妆图提示词不能为空。' }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `提示词不能超过 ${MAX_PROMPT_LENGTH} 个字符。` }, { status: 400 });

    const upstream = await fetch(`${API_BASE}/v1/image_generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: '9:16',
        response_format: 'url',
        n: 1,
        prompt_optimizer: true,
      }),
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '定妆图生成失败，请检查账号额度和模型权限。';
      return NextResponse.json({ error: message }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }

    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : `定妆图生成返回错误码 ${code}。`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const imageUrls = Array.isArray(data.data?.image_urls) ? data.data.image_urls : [];
    if (!imageUrls.length) return NextResponse.json({ error: '服务商未返回图片地址，请重试。' }, { status: 502 });

    return NextResponse.json({ imageUrls, id: data.id ?? null });
  } catch {
    return NextResponse.json({ error: '请求格式无效或暂时无法连接图片服务，请稍后重试。' }, { status: 502 });
  }
}
