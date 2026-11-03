import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { script } = await request.json();

  const cleaned = String(script || '').trim();
  if (!cleaned) {
    return NextResponse.json({ scenes: [] }, { status: 200 });
  }

  const blocks = cleaned
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const scenes = blocks.map((block, index) => {
    const sceneNameMatch = block.match(/(?:场景|SCENE)\s*[:：]?\s*(.+)/i);
    const sceneName = sceneNameMatch ? sceneNameMatch[1].trim() : `场景 ${index + 1}`;

    const lines = block
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);

    const shots = lines.map((line, shotIndex) => ({
      id: `shot-${index + 1}-${shotIndex + 1}`,
      title: `镜头 ${shotIndex + 1}`,
      description: line.replace(/^[-*\s]+/, '').slice(0, 120),
    }));

    return {
      id: `scene-${index + 1}`,
      name: sceneName,
      shots: shots.length > 0 ? shots : [{
        id: `shot-${index + 1}-1`,
        title: '镜头 1',
        description: '根据剧本内容生成的情绪镜头。',
      }],
    };
  });

  return NextResponse.json({ scenes });
}
