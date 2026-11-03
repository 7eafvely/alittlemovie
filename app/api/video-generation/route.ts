import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers/registry';

export const runtime = 'nodejs';

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json(
      { error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' },
      { status: 401 }
    );
  }

  try {
    const provider = getProvider();
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const duration = Number(body.duration);
    const resolution = body.resolution === '1080P' ? '1080P' : '768P';
    const firstFrameImage =
      typeof body.firstFrameImage === 'string' ? body.firstFrameImage.trim() : '';

    if (!prompt) {
      return NextResponse.json({ error: '镜头提示词不能为空。' }, { status: 400 });
    }
    if (prompt.length > provider.maxPromptLength) {
      return NextResponse.json(
        { error: `提示词不能超过 ${provider.maxPromptLength} 个字符。` },
        { status: 400 }
      );
    }
    if (!provider.supportedDurations.includes(duration)) {
      return NextResponse.json(
        {
          error: `当前服务商仅支持 ${provider.supportedDurations.join('、')} 秒镜头。`,
        },
        { status: 400 }
      );
    }
    if (!provider.supportedResolutions.includes(resolution)) {
      return NextResponse.json(
        { error: `当前服务商仅支持 ${provider.supportedResolutions.join('/')} 分辨率。` },
        { status: 400 }
      );
    }

    if (firstFrameImage) {
      let imageUrl: URL;
      try {
        imageUrl = new URL(firstFrameImage);
      } catch {
        return NextResponse.json(
          { error: '参考图必须是可公开访问的 HTTPS 图片链接。' },
          { status: 400 }
        );
      }
      if (imageUrl.protocol !== 'https:' || imageUrl.hostname === 'localhost') {
        return NextResponse.json(
          { error: '参考图必须是可公开访问的 HTTPS 图片链接。' },
          { status: 400 }
        );
      }
    }

    const result = await provider.submit({
      prompt,
      duration,
      resolution,
      firstFrameImage: firstFrameImage || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '视频服务提交失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
