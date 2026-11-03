import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = 'https://api.minimax.io';

export async function GET(request: Request) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' }, { status: 401 });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return NextResponse.json({ error: '服务端尚未配置 MINIMAX_API_KEY。' }, { status: 503 });

  const taskId = new URL(request.url).searchParams.get('taskId') ?? '';
  if (!/^\d{6,30}$/.test(taskId)) return NextResponse.json({ error: '任务编号格式无效。' }, { status: 400 });

  try {
    const upstream = await fetch(`${API_BASE}/v2/query/video_generation/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '查询任务失败，请稍后重试。';
      return NextResponse.json({ error: message }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }

    const task = data.task ?? data;
    const status = typeof task.status === 'string' ? task.status.toLowerCase() : 'unknown';
    const videoUrl = typeof task.content?.url === 'string' ? task.content.url : (typeof data.content?.url === 'string' ? data.content.url : null);
    const failure = typeof task.error === 'string' ? task.error : (typeof task.base_resp?.status_msg === 'string' ? task.base_resp.status_msg : null);
    return NextResponse.json({ taskId, status, videoUrl, error: failure });
  } catch {
    return NextResponse.json({ error: '暂时无法连接视频服务，请稍后重试。' }, { status: 502 });
  }
}
