import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

// 通义万相（阿里云百炼）文生图端点
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
const DASHSCOPE_TASK_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks';

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: '访问码错误。' }, { status: 401 });
  }

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (apiKey) {
    return generateWithWanx(request, apiKey);
  }

  // 回退：MiniMax
  return generateWithMiniMax(request);
}

async function generateWithWanx(request: Request, apiKey: string) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空。' }, { status: 400 });
    }

    const size = body.width && body.height ? `${body.width}*${body.height}` : '768*1024';

    const payload = {
      model: 'wanx2.1-t2i-turbo',
      input: { prompt },
      parameters: {
        size,
        n: 1,
        prompt_extend: true,
        watermark: false,
      },
    };

    // 异步调用：先提交任务拿到 task_id
    const submitRes = await fetch(DASHSCOPE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const submitData = await submitRes.json();

    if (!submitRes.ok) {
      const msg = submitData?.message || submitData?.code || '通义万相提交失败';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const taskId = submitData?.output?.task_id;
    if (!taskId) {
      return NextResponse.json({ error: '通义万相未返回任务 ID。' }, { status: 502 });
    }

    // 轮询任务状态（最多等 90 秒）
    const imageUrl = await pollTask(DASHSCOPE_TASK_URL, taskId, apiKey);
    if (!imageUrl) {
      return NextResponse.json({ error: '通义万相生成超时或失败。' }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : '通义万相生成失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function pollTask(url: string, taskId: string, apiKey: string): Promise<string | null> {
  const maxAttempts = 30;
  const intervalMs = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(`${url}/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    const statusData = await statusRes.json();
    const status = statusData?.output?.task_status;

    if (status === 'SUCCEEDED') {
      return statusData?.output?.results?.[0]?.url || null;
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

async function generateWithMiniMax(request: Request) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '未配置任何图片生成服务的 API Key。' }, { status: 500 });
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
