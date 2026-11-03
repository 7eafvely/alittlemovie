-- Project table - stores all project-level data
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT '未命名短剧',
  script TEXT NOT NULL DEFAULT '',
  character_notes TEXT,
  visual_style TEXT,
  monthly_spent REAL DEFAULT 0,
  video_price_per_second REAL DEFAULT 0.6,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scene table
CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shot table
CREATE TABLE IF NOT EXISTS shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration INT NOT NULL DEFAULT 5,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  make_video BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generation jobs table
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID REFERENCES shots(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  model VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  prompt TEXT,
  duration INT,
  resolution VARCHAR(20),
  video_url TEXT,
  estimated_cost REAL,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets table for storing video/audio/image references
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_id UUID REFERENCES shots(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  file_name VARCHAR(255),
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_shots_scene ON shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_jobs_shot ON generation_jobs(shot_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - user can only access their own data
CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage scenes via project" ON scenes
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage shots via project" ON shots
  FOR ALL USING (EXISTS (
    SELECT 1 FROM scenes
    JOIN projects ON projects.id = scenes.project_id
    WHERE scenes.id = shots.scene_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage jobs via project" ON generation_jobs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = generation_jobs.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage assets via project" ON assets
  FOR ALL USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = assets.project_id AND projects.user_id = auth.uid()
  ));
