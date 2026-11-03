import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const MAX_SCRIPT_LENGTH = 50_000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.script !== 'string') {
      return NextResponse.json({ error: '请提供剧本文本。' }, { status: 400 });
    }

    const cleaned = body.script.trim();
    if (!cleaned) return NextResponse.json({ error: '剧本内容不能为空。' }, { status: 400 });
    if (cleaned.length > MAX_SCRIPT_LENGTH) {
      return NextResponse.json({ error: `剧本不能超过 ${MAX_SCRIPT_LENGTH.toLocaleString()} 个字符。` }, { status: 413 });
    }

    const blocks = cleaned.split(/\n\s*\n+/).map((block: string) => block.trim()).filter(Boolean);
    const scenes = blocks.map((block: string, sceneIndex: number) => {
      const lines = block.split(/\n/).map((line: string) => line.trim()).filter(Boolean);
      const heading = lines[0].match(/^(?:场景|scene)\s*[^：:。]*[：:]?\s*(.*)$/i);
      const name = heading?.[1]?.trim() || lines[0].replace(/^[-*\s]+/, '').slice(0, 40) || `场景 ${sceneIndex + 1}`;
      const content = heading ? lines.slice(1) : lines;
      const shotLines = content.length ? content : [block];
      const shots = shotLines.map((line: string, shotIndex: number) => ({
        id: `scene-${sceneIndex + 1}-shot-${shotIndex + 1}`,
        title: `镜头 ${shotIndex + 1}`,
        description: line.replace(/^[-*\s]+/, '').slice(0, 500),
        duration: 5,
        status: 'draft' as const,
      }));
      return { id: `scene-${sceneIndex + 1}`, name, shots };
    });

    return NextResponse.json({ scenes });
  } catch {
    return NextResponse.json({ error: '无法读取请求内容，请检查剧本后重试。' }, { status: 400 });
  }
}
