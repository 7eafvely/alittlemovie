'use client';

import { useState } from 'react';

const sampleScript = `场景一：城市夜晚，女主在雨中奔跑。
她手里拿着一张旧照片，目光坚定。

场景二：咖啡店里，男主从门口走进来。
他看见她时，神情复杂，终于上前打招呼。

场景三：天亮，城市的街道悄然安静。
两人站在桥上，决定重新开始。`;

type Shot = {
  id: string;
  title: string;
  description: string;
};

type Scene = {
  id: string;
  name: string;
  shots: Shot[];
};

export default function Home() {
  const [script, setScript] = useState(sampleScript);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleParse = async () => {
    setIsLoading(true);

    const response = await fetch('/api/parse-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    });

    const data = await response.json();
    setScenes(data.scenes ?? []);
    setIsLoading(false);
  };

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand">Alittlemovie</div>
        <nav>
          <button className="nav-item active">项目</button>
          <button className="nav-item">剧本</button>
          <button className="nav-item">分镜</button>
          <button className="nav-item">成片</button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">个人创作者工作台</p>
            <h1>剧本到短剧：MVP</h1>
          </div>
          <button className="primary-btn">导出成片</button>
        </header>

        <div className="content-grid">
          <div className="panel script-panel">
            <div className="panel-header">
              <h2>剧本输入</h2>
              <span>AI 解析</span>
            </div>
            <textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              rows={14}
              placeholder="在这里粘贴你的剧本..."
            />
            <div className="panel-actions">
              <button className="primary-btn" onClick={handleParse} disabled={isLoading}>
                {isLoading ? '解析中...' : '生成分镜'}
              </button>
            </div>
          </div>

          <div className="panel shots-panel">
            <div className="panel-header">
              <h2>镜头列表</h2>
              <span>{scenes.length} 个场景</span>
            </div>

            <div className="scene-list">
              {scenes.length === 0 ? (
                <div className="empty-state">
                  <p>先输入剧本，再点“生成分镜”。</p>
                </div>
              ) : (
                scenes.map((scene) => (
                  <div className="scene-card" key={scene.id}>
                    <h3>{scene.name}</h3>
                    <div className="shot-stack">
                      {scene.shots.map((shot) => (
                        <div className="shot-card" key={shot.id}>
                          <span>{shot.title}</span>
                          <p>{shot.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
