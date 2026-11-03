import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ParsedScene {
  name: string;
  shots: ParsedShot[];
}

interface ParsedShot {
  title: string;
  description: string;
  duration: number;
  storyboardPrompt?: string;
  videoPrompt?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const markdown = body.markdown;

    if (typeof markdown !== 'string' || !markdown.trim()) {
      return NextResponse.json({ error: '请提供导演手册 Markdown 内容。' }, { status: 400 });
    }

    const lines = markdown.split('\n');

    // Extract episode title from first heading
    let episodeTitle = '';
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)/);
      if (match) { episodeTitle = match[1].trim(); break; }
    }

    // Parse the timeline table to get lens data
    const shots: ParsedShot[] = [];
    let inTable = false;
    let inTableHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect table header
      if (trimmed.includes('| 镜号 |') && trimmed.includes('镜头名 |')) {
        inTable = true;
        inTableHeader = true;
        continue;
      }
      if (inTableHeader && trimmed.startsWith('|---')) {
        inTableHeader = false;
        continue;
      }
      if (inTable && !inTableHeader && trimmed.startsWith('|') && trimmed.includes('|')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 4 && /^\d+$/.test(cells[0])) {
          shots.push({
            title: cells[1] || `镜头 ${cells[0]}`,
            description: '',
            duration: parseInt(cells[3], 10) || 5,
          });
        }
      }
      // End of table
      if (inTable && !inTableHeader && !trimmed.startsWith('|')) {
        inTable = false;
      }
    }

    // Parse individual lens sections for detailed content
    const lensSections = markdown.split(/###\s+镜\d+/);
    let sectionIdx = 0;
    for (let i = 1; i < lensSections.length && sectionIdx < shots.length; i++, sectionIdx++) {
      const section = lensSections[i];

      // Extract storyboard prompt
      const storyMatch = section.match(/\*\*A段\s+分镜图\*\*\s*```\s*([\s\S]*?)```/);
      if (storyMatch) {
        shots[sectionIdx].storyboardPrompt = storyMatch[1].trim();
      }

      // Extract description from A段 section (the first part before the code block or the reference lines)
      const descMatch = section.match(/\*\*A段\s+分镜图\*\*[\s\S]*?画面[：:]([^\n]+)/);
      if (descMatch) {
        shots[sectionIdx].description = descMatch[1].trim();
      }

      // Extract video prompt
      const videoMatch = section.match(/\*\*B段\s+视频\*\*\s*```\s*([\s\S]*?)```/);
      if (videoMatch) {
        shots[sectionIdx].videoPrompt = videoMatch[1].trim();
      }

      // If no description from A-section, try to get it from B-section content
      if (!shots[sectionIdx].description) {
        const bDescMatch = section.match(/\*\*B段\s+视频\*\*[\s\S]*?画面[：:]([^\n]+)/);
        if (bDescMatch) {
          shots[sectionIdx].description = bDescMatch[1].trim();
        }
      }

      // Fallback: use scene description from the 背景场景 section
      if (!shots[sectionIdx].description) {
        const bgMatch = section.match(/背景场景[：:]\s*\n([^\n]+)/);
        if (bgMatch) {
          shots[sectionIdx].description = bgMatch[1].trim();
        }
      }
    }

    if (shots.length === 0) {
      // Fallback: try to parse individual lens sections directly
      const allLensMatches = Array.from(markdown.matchAll(/###\s+(镜\d+)[｜|]([^（\n]+)[（(](\d+)s[）)]/g));
      for (const match of allLensMatches) {
        shots.push({
          title: match[2].trim(),
          description: '',
          duration: parseInt(match[3], 10) || 5,
        });
      }

      // Parse individual sections for descriptions
      const allSections = markdown.split(/###\s+镜\d+/);
      for (let i = 1; i < allSections.length && i - 1 < shots.length; i++) {
        const section = allSections[i];
        const descMatch = section.match(/\*\*A段\s+分镜图\*\*[\s\S]*?画面[：:]([^\n]+)/);
        if (descMatch) {
          shots[i - 1].description = descMatch[1].trim();
        }
        const storyMatch = section.match(/\*\*A段\s+分镜图\*\*\s*```\s*([\s\S]*?)```/);
        if (storyMatch) {
          shots[i - 1].storyboardPrompt = storyMatch[1].trim();
        }
        const videoMatch = section.match(/\*\*B段\s+视频\*\*\s*```\s*([\s\S]*?)```/);
        if (videoMatch) {
          shots[i - 1].videoPrompt = videoMatch[1].trim();
        }
      }
    }

    if (shots.length === 0) {
      return NextResponse.json({ error: '未能从导演手册中解析到镜头数据。请确认 Markdown 格式包含镜头时间轴表格。' }, { status: 400 });
    }

    // Group shots by scene
    const sceneSize = 8;
    const scenes: ParsedScene[] = [];
    for (let i = 0; i < shots.length; i += sceneSize) {
      const group = shots.slice(i, i + sceneSize);
      const firstShotNum = i + 1;
      const lastShotNum = Math.min(i + sceneSize, shots.length);
      scenes.push({
        name: `镜${String(firstShotNum).padStart(2, '0')}-${String(lastShotNum).padStart(2, '0')}`,
        shots: group.map((shot, idx) => ({
          id: `shot-${i + idx + 1}`,
          title: shot.title,
          description: shot.description || shot.title,
          duration: shot.duration,
          status: 'draft' as const,
          storyboardPrompt: shot.storyboardPrompt,
          videoPrompt: shot.videoPrompt,
        })),
      });
    }

    const summary = {
      episodeTitle,
      totalShots: shots.length,
      totalDuration: shots.reduce((sum, s) => sum + s.duration, 0),
    };

    return NextResponse.json({ summary, scenes, shots });
  } catch (err) {
    return NextResponse.json({ error: '导演手册解析失败。' }, { status: 500 });
  }
}