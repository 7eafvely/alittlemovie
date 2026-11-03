// Supabase client — only creates the admin client on the server side.
// For MVP we use a simple role-key approach; add auth later.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectRecord {
  id?: string;
  user_id?: string;
  name: string;
  script: string;
  character_notes?: string;
  visual_style?: string;
  monthly_spent: number;
  video_price_per_second: number;
  created_at?: string;
  updated_at?: string;
}

export interface SceneRecord {
  id?: string;
  project_id: string;
  name: string;
  sort_order: number;
}

export interface ShotRecord {
  id?: string;
  scene_id: string;
  title: string;
  description: string;
  duration: number;
  status: string;
  make_video: boolean;
  sort_order: number;
}

export interface JobRecord {
  id?: string;
  shot_id?: string;
  project_id: string;
  provider: string;
  task_id: string;
  model?: string;
  status: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
  video_url?: string;
  estimated_cost?: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssetRecord {
  id?: string;
  project_id: string;
  shot_id?: string;
  type: string;
  url: string;
  file_name?: string;
  size_bytes?: number;
}

let supabase: SupabaseClient | null = null;

const getClient = (): SupabaseClient | null => {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase client can only be used server-side');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabase) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
    } catch {
      return null;
    }
  }

  return supabase;
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getProjectsTable() {
  return getClient()?.from('projects');
}

export function getScenesTable() {
  return getClient()?.from('scenes');
}

export function getShotsTable() {
  return getClient()?.from('shots');
}

export function getJobsTable() {
  return getClient()?.from('generation_jobs');
}

export function getAssetsTable() {
  return getClient()?.from('assets');
}
