import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.io';

// 归一化 v1 状态为大写首字母 → 前端可识别的英文小写 key
const STATUS_MAP: Record<string, string> = {
  preparing: 'preparing',
  queueing: 'queueing',
  processing: 'processing',
  success: 'success',
  fail: 'failed',
};

function normalizeStatus(raw: unknown): string {
  const key = String(raw ?? '').toLowerCase();
  return STATUS_MAP[key] ?? 'unknown';
}

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
    // v1 创建的任务必须用 v1 查询接口（task_id 走 query 参数，不是 path）
    const upstream = await fetch(`${API_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '查询任务失败，请稍后重试。';
      return NextResponse.json({ error: message }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }
    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : `查询返回错误码 ${code}，请稍后重试。`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const status = normalizeStatus(data.status);
    let videoUrl: string | null = null;

    // 成功后再用 file_id 换取限时下载地址（有效期 1 小时）
    if (status === 'success' && data.file_id != null) {
      const fileResp = await fetch(`${API_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(String(data.file_id))}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      const fileData = await fileResp.json().catch(() => ({}));
      videoUrl = typeof fileData.file?.download_url === 'string' ? fileData.file.download_url : null;
      if (fileResp.ok && !videoUrl) {
        const message = typeof fileData.base_resp?.status_msg === 'string' ? fileData.base_resp.status_msg : '视频已生成，但未取到下载地址，请稍后重试。';
        return NextResponse.json({ taskId, status, videoUrl: null, error: message });
      }
    }

    const failure = status === 'failed' ? (typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '生成失败，请查看服务商控制台。') : null;
    return NextResponse.json({ taskId, status, videoUrl, error: failure });
  } catch {
    return NextResponse.json({ error: '暂时无法连接视频服务，请稍后重试。' }, { status: 502 });
  }
}
