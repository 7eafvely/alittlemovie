'use client';

import { useEffect, useMemo, useState } from 'react';

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
  duration: number;
  status: 'draft' | 'ready';
};

type Scene = { id: string; name: string; shots: Shot[] };
type Project = { name: string; script: string; scenes: Scene[] };
const STORAGE_KEY = 'alittlemovie-project-v1';

export default function Home() {
  const [projectName, setProjectName] = useState('雨夜重逢');
  const [script, setScript] = useState(sampleScript);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const project = JSON.parse(stored) as Project;
      setProjectName(project.name || '未命名短剧');
      setScript(project.script || sampleScript);
      setScenes(Array.isArray(project.scenes) ? project.scenes : []);
      setSaved(true);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const shotCount = useMemo(() => scenes.reduce((total, scene) => total + scene.shots.length, 0), [scenes]);
  const totalDuration = useMemo(
    () => scenes.reduce((total, scene) => total + scene.shots.reduce((sum, shot) => sum + shot.duration, 0), 0),
    [scenes],
  );

  const updateShot = (sceneId: string, shotId: string, changes: Partial<Shot>) => {
    setScenes((current) => current.map((scene) => scene.id !== sceneId ? scene : {
      ...scene,
      shots: scene.shots.map((shot) => shot.id === shotId ? { ...shot, ...changes } : shot),
    }));
    setSaved(false);
  };

  const parseScript = async () => {
    setIsLoading(true);
    setNotice('');
    try {
      const response = await fetch('/api/parse-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '剧本解析失败，请重试。');
      setScenes(data.scenes ?? []);
      setSaved(false);
      setNotice(`已拆分为 ${data.scenes.length} 个场景、${data.scenes.reduce((n: number, scene: Scene) => n + scene.shots.length, 0)} 个镜头。请检查并编辑分镜。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '发生未知错误。');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProject = () => {
    const project: Project = { name: projectName, script, scenes };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    setSaved(true);
    setNotice('项目已保存在当前浏览器。');
  };

  const exportProject = () => {
    const project = { name: projectName, script, scenes, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'alittlemovie-project'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('项目数据已导出为 JSON；视频合成尚未接入。');
  };

  const copyPrompt = async (shot: Shot) => {
    const prompt = `${shot.description}\n电影感短剧镜头，竖屏 9:16，时长约 ${shot.duration} 秒。保持角色外观与场景连续性。`;
    try {
      await navigator.clipboard.writeText(prompt);
      setNotice('镜头提示词已复制，可粘贴到你选择的视频生成服务中。');
    } catch {
      setNotice(prompt);
    }
  };

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Alittlemovie 首页"><span className="brand-mark">A</span>alittlemovie</a>
        <p className="sidebar-label">创作空间</p>
        <nav aria-label="主导航">
          <a className="nav-item active" href="#script">✦ <span>剧本工作台</span></a>
          <a className="nav-item" href="#storyboard">▤ <span>分镜故事板</span></a>
          <a className="nav-item" href="#guide">◈ <span>生成指南</span></a>
        </nav>
        <div className="sidebar-note"><span className="status-dot" /> 本地草稿模式<p>项目保存在当前浏览器</p></div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">独立创作者 · AI 短剧工作台</p>
            <h1>把灵感，拍成一部短剧。</h1>
            <p className="subtitle">从剧本拆解开始，逐镜打磨你的故事。</p>
          </div>
          <div className="top-actions">
            <button className="secondary-btn" onClick={saveProject}>保存草稿</button>
            <button className="primary-btn" onClick={exportProject}>导出项目</button>
          </div>
        </header>

        {notice && <div className="notice" role="status"><span>✦</span>{notice}<button onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}

        <section className="project-bar panel">
          <div className="project-icon">▶</div>
          <label className="project-name-label">项目名称<input value={projectName} onChange={(event) => { setProjectName(event.target.value); setSaved(false); }} aria-label="项目名称" /></label>
          <div className="project-stats"><span><b>{scenes.length}</b> 场景</span><i /><span><b>{shotCount}</b> 镜头</span><i /><span><b>{totalDuration}</b> 秒预估</span></div>
          <span className={`save-state ${saved ? 'is-saved' : ''}`}>{saved ? '● 已保存' : '○ 未保存'}</span>
        </section>

        <div className="content-grid">
          <section className="panel script-panel" id="script">
            <div className="panel-heading"><div><span className="step">01</span><div><h2>你的剧本</h2><p>先写下故事，空行或“场景”标题用于区分场景</p></div></div><span className="ai-tag">✦ 创作起点</span></div>
            <textarea value={script} onChange={(event) => { setScript(event.target.value); setSaved(false); }} rows={15} maxLength={50000} placeholder="在这里粘贴你的故事梗概或剧本……" aria-label="剧本内容" />
            <div className="editor-footer"><span>{script.length.toLocaleString()} / 50,000 字符</span><button className="primary-btn" onClick={parseScript} disabled={isLoading || !script.trim()}>{isLoading ? <><span className="spinner" /> 正在拆解…</> : '✦ 拆解成分镜'}</button></div>
            <div className="tip"><span>✦</span><p><b>小提示</b>：每个空行会被识别为新的场景段落；你可以在生成后逐镜编辑描述和时���。</p></div>
          </section>

          <section className="panel storyboard-panel" id="storyboard">
            <div className="panel-heading"><div><span className="step">02</span><div><h2>分镜故事板</h2><p>检查、润色每个镜头，再生成素材</p></div></div><span className="count-pill">{shotCount} 镜头</span></div>
            <div className="scene-list">
              {scenes.length === 0 ? <div className="empty-state"><div className="empty-icon">▧</div><h3>故事板还空着</h3><p>拆解剧本后，场景和镜头会出现在这里。</p><span>✦ 每个镜头都可以独立编辑</span></div> : scenes.map((scene, sceneIndex) => (
                <article className="scene-card" key={scene.id}>
                  <div className="scene-heading"><span className="scene-number">SCENE {String(sceneIndex + 1).padStart(2, '0')}</span><h3>{scene.name}</h3><span className="scene-shot-count">{scene.shots.length} 镜头</span></div>
                  <div className="shot-stack">{scene.shots.map((shot, shotIndex) => (
                    <div className="shot-card" key={shot.id}>
                      <div className="shot-topline"><span className="shot-number">{String(shotIndex + 1).padStart(2, '0')}</span><span className="shot-label">镜头描述</span><label className="duration-control">时长 <input type="number" min="1" max="30" value={shot.duration} onChange={(event) => updateShot(scene.id, shot.id, { duration: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} /> 秒</label></div>
                      <textarea className="shot-description" value={shot.description} rows={2} onChange={(event) => updateShot(scene.id, shot.id, { description: event.target.value })} aria-label={`${shot.title}描述`} />
                      <div className="shot-actions"><span className="draft-label">● {shot.status === 'ready' ? '已检查' : '待检查'}</span><button className="text-btn" onClick={() => copyPrompt(shot)}>复制生成提示词 ↗</button></div>
                    </div>
                  ))}</div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="generation-panel panel" id="guide">
          <div className="generation-icon">✧</div><div className="generation-copy"><h2>下一步：生成视频素材</h2><p>先完成分镜审核。连接视频生成服务后，就能逐镜提交任务并在这里追踪进度。</p></div><span className="coming-soon">服务商待配置</span>
        </section>
        <footer className="footer-note">Alittlemovie Studio <span>·</span> 创作工具仍在早期开发中</footer>
      </section>
    </main>
  );
}
