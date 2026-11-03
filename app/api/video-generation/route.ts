import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.io';
const ALLOWED_DURATIONS = new Set([6, 10]);
const MAX_PROMPT_LENGTH = 2_000;

function hasAccess(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: Request) {
  if (!hasAccess(request)) {
    return NextResponse.json({ error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' }, { status: 401 });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: '服务端尚未配置 MINIMAX_API_KEY。请在本地 .env.local 中配置后重启服务。' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const duration = Number(body.duration);
    const resolution = body.resolution === '1080P' ? '1080P' : '768P';
    const firstFrameImage = typeof body.firstFrameImage === 'string' ? body.firstFrameImage.trim() : '';

    if (!prompt) return NextResponse.json({ error: '镜头提示词不能为空。' }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `提示词不能超过 ${MAX_PROMPT_LENGTH} 个字符。` }, { status: 400 });
    if (!ALLOWED_DURATIONS.has(duration)) return NextResponse.json({ error: '当前仅支持 6 秒或 10 秒镜头。' }, { status: 400 });
    if (duration === 10 && resolution === '1080P') return NextResponse.json({ error: 'MiniMax-Hailuo-2.3 的 10 秒镜头仅支持 768P，请改用 768P 或把时长缩短为 6 秒。' }, { status: 400 });

    if (firstFrameImage) {
      let imageUrl: URL;
      try { imageUrl = new URL(firstFrameImage); }
      catch { return NextResponse.json({ error: '参考图必须是可公开访问的 HTTPS 图片链接。' }, { status: 400 }); }
      if (imageUrl.protocol !== 'https:' || imageUrl.hostname === 'localhost') {
        return NextResponse.json({ error: '参考图必须是可公开访问的 HTTPS 图片链接。' }, { status: 400 });
      }
    }

    const payload: Record<string, unknown> = {
      model: 'MiniMax-Hailuo-2.3', prompt, duration, resolution,
    };
    if (firstFrameImage) payload.first_frame_image = firstFrameImage;

    const upstream = await fetch(`${API_BASE}/v1/video_generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '视频服务提交失败，请检查账号额度、模型权限和请求参数。';
      return NextResponse.json({ error: message }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }
    // MiniMax v1 业务错误时仍返回 HTTP 200，需检查 base_resp.status_code
    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : `视频服务返回错误码 ${code}，请查看服务商控制台。`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    if (typeof data.task_id !== 'string' || !data.task_id) {
      return NextResponse.json({ error: '服务商没有返回任务编号，请查看服务商控制台。' }, { status: 502 });
    }

    return NextResponse.json({ taskId: data.task_id, model: 'MiniMax-Hailuo-2.3', duration, resolution });
  } catch {
    return NextResponse.json({ error: '请求格式无效或暂时无法连接视频服务，请稍后重试。' }, { status: 400 });
  }
}
