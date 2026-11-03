import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers/registry';

export const runtime = 'nodejs';

function hasAccess(request: NextRequest) {
  const expected = process.env.ALITTLEMOVIE_ACCESS_CODE;
  const supplied = request.headers.get('x-alittlemovie-access-code');
  return Boolean(expected && supplied && supplied === expected);
}

export async function GET(request: NextRequest) {
  if (!hasAccess(request)) {
    return NextResponse.json(
      { error: '访问码错误，或服务端尚未配置 ALITTLEMOVIE_ACCESS_CODE。' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId 参数。' }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const result = await provider.queryStatus(taskId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
