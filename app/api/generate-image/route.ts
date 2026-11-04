import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/libtv';

export const runtime = 'nodejs';

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: '访问码错误。' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误。' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json({ error: '提示词不能为空。' }, { status: 400 });
  }

  const name = typeof body.name === 'string' && body.name ? body.name : undefined;
  const ratio = typeof body.ratio === 'string' ? body.ratio : '9:16';

  // 优先通义万相（DashScope，稳定有额度）
  if (process.env.DASHSCOPE_API_KEY) {
    return fallbackDashScope(body);
  }

  // 回退 LibTV（AutoPic 模型，画质精致，但需账号有算力）
  try {
    const imageUrl = await generateImage(prompt, { name, ratio });
    return NextResponse.json({ imageUrl, provider: 'libtv' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function fallbackDashScope(body: any) {
  const apiKey = process.env.DASHSCOPE_API_KEY!;
  try {
    const prompt = body.prompt as string;
    const size = '768*1024';

    const payload = {
      model: 'wanx2.1-t2i-turbo',
      input: { prompt },
      parameters: { size, n: 1, prompt_extend: true, watermark: false },
    };

    const submitRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
    });

    const submitData = await submitRes.json();
    const taskId = submitData?.output?.task_id;
    if (!taskId) {
      return NextResponse.json({ error: '通义万相提交失败' }, { status: 502 });
    }

    // 轮询
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusData = await statusRes.json();
      const status = statusData?.output?.task_status;
      if (status === 'SUCCEEDED') {
        const url = statusData?.output?.results?.[0]?.url;
        if (url) return NextResponse.json({ imageUrl: url, provider: 'dashscope' });
      }
      if (status === 'FAILED' || status === 'CANCELED') break;
    }

    return NextResponse.json({ error: '通义万相生成超时' }, { status: 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '通义万相失败';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
