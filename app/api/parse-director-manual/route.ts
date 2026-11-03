import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ParsedCharacter {
  id: string;
  name: string;
  description: string;
  look?: string;
  fullPrompt?: string;
}

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
  hasDialog?: boolean;
  isKeyMoment?: boolean;
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
      if (match) {
        let title = match[1].trim();
        // Clean: remove "导演手册" suffix, keep episode identifier
        title = title.replace(/导演手册$/, '').trim();
        episodeTitle = title;
        break;
      }
    }

    // ====== Parse Characters from Asset Table ======
    const characters: ParsedCharacter[] = [];
    const characterNames = new Set<string>();
    let inAssetTable = false;
    let inAssetTableHeader = false;
    const assetRows: string[][] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Find asset table
      if (trimmed.includes('| 编号 |') && (trimmed.includes('资产 |') || trimmed.includes('资产'))) {
        inAssetTable = true;
        inAssetTableHeader = true;
        continue;
      }
      if (inAssetTableHeader && trimmed.startsWith('|---')) {
        inAssetTableHeader = false;
        continue;
      }
      if (inAssetTable && !inAssetTableHeader && trimmed.startsWith('|') && trimmed.includes('|')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length >= 3 && cells[0].startsWith('P')) {
          assetRows.push(cells);
        }
      }
      if (inAssetTable && !trimmed.includes('| 编号 |') && !trimmed.startsWith('|') && trimmed.length > 0 && !trimmed.startsWith('#')) {
        inAssetTable = false;
      }
    }

    // Parse character details from asset sections (P01, P02, P09 etc)
    for (const row of assetRows) {
      const pid = row[0];
      const assetName = row[1];
      const lookInfo = row[2];
      // Extract character name
      const nameMatch = assetName.match(/^([^\s（]+)/);
      const charName = nameMatch ? nameMatch[1].trim() : '';
      if (!charName || characterNames.has(charName)) continue;

      characterNames.add(charName);

      // Find the full prompt for this character
      let fullPrompt = '';
      const promptSection = markdown.split(`**${pid}`).slice(1).join('');
      const sectionEnd = promptSection.indexOf('\n\n---');
      const relevantSection = sectionEnd > 0 ? promptSection.substring(0, sectionEnd) : promptSection.substring(0, Math.min(3000, promptSection.length));

      // Extract from markdown code block after the character heading
      const codeMatch = relevantSection.match(/```\s*\n([\s\S]*?)```/);
      if (codeMatch) {
        fullPrompt = codeMatch[1].trim();
      }

      // Build a concise character description from the prompt
      let description = lookInfo || '';
      if (fullPrompt && !description) {
        // Extract key info: age, gender, appearance from prompt
        const ageMatch = fullPrompt.match(/(\d+岁[^\n]+)/);
        const heightMatch = fullPrompt.match(/身高([^\n]+)/);
        description = [
          ageMatch ? ageMatch[1] : '',
          heightMatch ? heightMatch[1] : '',
        ].filter(Boolean).join('，');
      }
      if (!description) {
        description = charName;
      }

      characters.push({
        id: pid,
        name: charName,
        description,
        look: lookInfo || undefined,
        fullPrompt: fullPrompt || undefined,
      });
    }

    // Try alternative: parse from asset prompts (P01, P02 sections directly)
    if (characters.length === 0) {
      const assetSections = markdown.matchAll(/\*\*(P\d+)\s+([^*]+)\*\*[\s\S]*?```\s*\n([\s\S]*?)```/g);
      for (const match of Array.from(assetSections)) {
        const header = match[2].trim();
        const nameMatch = header.match(/^([^\s]+)/);
        const charName = nameMatch ? nameMatch[1].trim() : '';
        if (!charName || characterNames.has(charName)) continue;
        characterNames.add(charName);

        const fullPrompt = match[3].trim();
        const ageMatch = fullPrompt.match(/(\d+岁[^\n]+)/);
        const heightMatch = fullPrompt.match(/身高([^\n]+)/);
        const description = [
          ageMatch ? ageMatch[1] : '',
          heightMatch ? heightMatch[1] : '',
        ].filter(Boolean).join('，') || charName;

        characters.push({
          id: match[1],
          name: charName,
          description,
          fullPrompt,
        });
      }
    }

    // ====== Parse Shots from Timeline Table ======
    const shots: ParsedShot[] = [];
    let inTable = false;
    let inTableHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('| 镜号 |') && (trimmed.includes('镜头名 |') || trimmed.includes('镜头'))) {
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
          // Column layout: 镜号|镜头名|时间|时长|场景|生成方式|口型镜|首帧
          // cells[0]=镜号 cells[1]=镜头名 cells[3]=时长 cells[6]=口型镜
          const dialogCell = cells.length >= 7 ? cells[6] : '';
          const hasDialog = dialogCell.startsWith('是');
          const title = cells[1] || `镜头 ${cells[0]}`;

          // Detect key moments: scenes with confrontations, expressions, reactions
          const isKeyMoment = hasDialog ||
            title.includes('对视') || title.includes('落座') ||
            title.includes('回头') || title.includes('起身') ||
            title.includes('成交') || title.includes('领证') ||
            title.includes('逗笑') || title.includes('坦白');

          shots.push({
            title,
            description: '',
            duration: parseInt(cells[3], 10) || 5,
            hasDialog,
            isKeyMoment,
          });
        }
      }
      if (inTable && !inTableHeader && !trimmed.startsWith('|')) {
        inTable = false;
      }
    }

    // Parse individual shot sections
    const shotSections = markdown.split(/###\s+镜\d+/);
    let sectionIdx = 0;
    for (let i = 1; i < shotSections.length && sectionIdx < shots.length; i++, sectionIdx++) {
      const section = shotSections[i];

      const storyMatch = section.match(/\*\*A段\s+分镜图\*\*\s*```\s*([\s\S]*?)```/);
      if (storyMatch) shots[sectionIdx].storyboardPrompt = storyMatch[1].trim();

      const descMatch = section.match(/\*\*A段\s+分镜图\*\*[\s\S]*?画面[：:]([^\n]+)/);
      if (descMatch) shots[sectionIdx].description = descMatch[1].trim();

      const videoMatch = section.match(/\*\*B段\s+视频\*\*\s*```\s*([\s\S]*?)```/);
      if (videoMatch) shots[sectionIdx].videoPrompt = videoMatch[1].trim();

      if (!shots[sectionIdx].description) {
        const bgMatch = section.match(/背景场景[：:]\s*\n([^\n]+)/);
        if (bgMatch) shots[sectionIdx].description = bgMatch[1].trim();
      }

      // Mark key moments from section content
      const sectionText = section.toLowerCase();
      if (sectionText.includes('本集甜点') || sectionText.includes('甜点') ||
          sectionText.includes('对视') && sectionText.includes('四目')) {
        shots[sectionIdx].isKeyMoment = true;
      }
    }

    if (shots.length === 0) {
      return NextResponse.json({ error: '未能从导演手册中解析到镜头数据。' }, { status: 400 });
    }

    // ====== Extract Visual Style ======
    let visualStyle = '现代精致国漫，电影级2.5D动画质感，柔和电影光影，暖色调，9:16竖屏';
    const styleMatch = markdown.match(/\[视觉风格[：:]([^\]]+)\]/);
    if (styleMatch) visualStyle = styleMatch[1].trim();

    // ====== Group shots by scene ======
    const sceneSize = 8;
    const scenes: ParsedScene[] = [];
    for (let i = 0; i < shots.length; i += Math.min(sceneSize, Math.ceil(shots.length / Math.ceil(shots.length / sceneSize)))) {
      const group = shots.slice(i, i + Math.min(sceneSize, Math.ceil(shots.length / Math.ceil(shots.length / sceneSize))));
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
          makeVideo: false,
          hasDialog: shot.hasDialog,
          isKeyMoment: shot.isKeyMoment,
          storyboardPrompt: shot.storyboardPrompt,
          videoPrompt: shot.videoPrompt,
        })),
      });
    }

    // Simplify: just make 3-4 even groups
    const groupCount = Math.min(Math.ceil(shots.length / 7), 4);
    const perGroup = Math.ceil(shots.length / groupCount);
    const groupedScenes: ParsedScene[] = [];
    for (let i = 0; i < shots.length; i += perGroup) {
      const group = shots.slice(i, i + perGroup);
      const firstNum = i + 1;
      const lastNum = Math.min(i + perGroup, shots.length);
      groupedScenes.push({
        name: `拍摄组 ${String(firstNum).padStart(2, '0')}-${String(lastNum).padStart(2, '0')}`,
        shots: group.map((shot, idx) => ({
          id: `shot-${i + idx + 1}`,
          title: shot.title,
          description: shot.description || shot.title,
          duration: shot.duration,
          status: 'draft' as const,
          makeVideo: false,
          hasDialog: shot.hasDialog,
          isKeyMoment: shot.isKeyMoment,
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

    return NextResponse.json({
      summary,
      scenes: groupedScenes,
      shots: shots.map((s, i) => ({
        ...s,
        id: `shot-${i + 1}`,
        makeVideo: false,
        status: 'draft' as const,
      })),
      characters,
      visualStyle,
    });
  } catch (err) {
    return NextResponse.json({ error: '导演手册解析失败。' }, { status: 500 });
  }
}