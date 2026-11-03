import { NextResponse } from 'next/server';
import { LiblibAI } from 'liblibai';

export const runtime = 'nodejs';

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

// LiblibAI 国漫底模 ID（用户可在 LiblibAI 站内找更合适的底模替换）
const DEFAULT_CHECKPOINT_ID = process.env.LIBLIB_CHECKPOINT_ID || '';

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: '访问码错误。' }, { status: 401 });
  }

  const apiKey = process.env.LIBLIB_API_KEY;
  const apiSecret = process.env.LIBLIB_API_SECRET;

  // 优先使用 LiblibAI（画质更精致），否则回退 MiniMax
  if (apiKey && apiSecret) {
    return generateWithLiblib(request);
  }

  return generateWithMiniMax(request);
}

async function generateWithLiblib(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const width = typeof body.width === 'number' ? body.width : 768;
    const height = typeof body.height === 'number' ? body.height : 1024;
    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空。' }, { status: 400 });
    }

    const client = new LiblibAI({
      apiKey: process.env.LIBLIB_API_KEY!,
      apiSecret: process.env.LIBLIB_API_SECRET!,
    });

    const generateParams: Record<string, any> = {
      prompt,
      negativePrompt: 'ng_deepnegative_v1_75t,(badhandv4:1.2),EasyNegative,(worst quality:2),lowres,bad anatomy,bad hands,text,error,missing fingers,extra digit,fewer digits,cropped,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,username,blurry',
      steps: 25,
      cfgScale: 7,
      width,
      height,
      imgCount: 1,
      seed: -1,
      restoreFaces: 1,
    };

    // 只有配置了底模 ID 才传入，否则用 LiblibAI 默认
    if (DEFAULT_CHECKPOINT_ID) {
      generateParams.checkPointId = DEFAULT_CHECKPOINT_ID;
    }

    const result = await client.text2img({ generateParams });
    const imageUrl = result?.images?.[0]?.imageUrl;

    if (!imageUrl) {
      return NextResponse.json({ error: 'LiblibAI 未返回图片。' }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'LiblibAI 生成失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
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
