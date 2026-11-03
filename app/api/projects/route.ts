import { NextResponse } from 'next/server';
import { getProjectsTable, getScenesTable, getShotsTable, isSupabaseConfigured } from '@/lib/db/client';

export const runtime = 'nodejs';

function getUserId(request: Request): string {
  const header = request.headers.get('x-alittlemovie-user-id');
  return (header || 'local-dev-user').substring(0, 128);
}

function checkDb() {
  if (!isSupabaseConfigured()) return null;
  return { projects: getProjectsTable()!, scenes: getScenesTable()!, shots: getShotsTable()! };
}

export async function GET(request: Request) {
  const db = checkDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  try {
    const userId = getUserId(request);
    const { data, error } = await db.projects.select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ projects: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = checkDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { name, script, characterNotes, visualStyle, monthlySpent, videoPricePerSecond, scenes } = body;
    if (!name || !script) return NextResponse.json({ error: 'Name and script required' }, { status: 400 });

    const { data: project, error: projError } = await db.projects.insert({
      user_id: userId, name, script,
      character_notes: characterNotes || null,
      visual_style: visualStyle || null,
      monthly_spent: monthlySpent || 0,
      video_price_per_second: videoPricePerSecond || 0.6,
      updated_at: new Date().toISOString(),
    }).select().single();

    if (projError) throw new Error(projError.message);

    if (Array.isArray(scenes)) {
      for (let s = 0; s < scenes.length; s++) {
        const scene = scenes[s];
        const { data: sceneRow, error: sceneError } = await db.scenes.insert({
          project_id: project.id, name: scene.name || `Scene ${s + 1}`, sort_order: s,
        }).select().single();
        if (sceneError) continue;

        if (Array.isArray(scene.shots)) {
          const shotRows = scene.shots.map((shot: any, idx: number) => ({
            scene_id: sceneRow.id,
            title: shot.title || `Shot ${idx + 1}`,
            description: shot.description || '',
            duration: shot.duration || 5,
            status: shot.status || 'draft',
            make_video: Boolean(shot.makeVideo),
            sort_order: idx,
          }));
          await db.shots.insert(shotRows);
        }
      }
    }
    return NextResponse.json({ project }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
