import { NextRequest, NextResponse } from 'next/server';
import { getProjectsTable, getScenesTable, getShotsTable, getJobsTable, isSupabaseConfigured } from '@/lib/db/client';

export const runtime = 'nodejs';

function checkDb() {
  if (!isSupabaseConfigured()) return null;
  return { projects: getProjectsTable()!, scenes: getScenesTable()!, shots: getShotsTable()!, jobs: getJobsTable()! };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = checkDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  try {
    const projectId = params.id;
    const { data: project, error: projError } = await db.projects.select('*').eq('id', projectId).single();
    if (projError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: scenes } = await db.scenes.select('*').eq('project_id', projectId).order('sort_order');
    const sceneList: any[] = [];
    if (scenes) {
      for (const scene of scenes) {
        const { data: shots } = await db.shots.select('*').eq('scene_id', scene.id).order('sort_order');
        sceneList.push({ id: scene.id, name: scene.name, shots: (shots || []).map((s: any) => ({ id: s.id, title: s.title, description: s.description, duration: s.duration, status: s.status, makeVideo: s.make_video })) });
      }
    }

    const { data: jobs } = await db.jobs.select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    return NextResponse.json({
      project: { id: project.id, name: project.name, script: project.script, characterNotes: project.character_notes, visualStyle: project.visual_style, monthlySpent: project.monthly_spent, videoPricePerSecond: project.video_price_per_second, updatedAt: project.updated_at },
      scenes: sceneList,
      jobs: (jobs || []).map((j: any) => ({ id: j.id, shotId: j.shot_id, taskId: j.task_id, provider: j.provider, model: j.model, status: j.status, prompt: j.prompt, duration: j.duration, resolution: j.resolution, videoUrl: j.video_url, estimatedCost: j.estimated_cost, error: j.error, createdAt: j.created_at })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = checkDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  try {
    const { error } = await db.projects.delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
