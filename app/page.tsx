'use client';

import { useEffect, useMemo, useState } from 'react';

const sampleScript = `场景一：城市夜晚，女主在雨中奔跑。
她手里拿着一张旧照片，目光坚定。

场景二：咖啡店里，男主从门口走进来。
他看见她时，神情复杂，终于上前打招呼。

场景三：天亮，城市的街道悄然安静。
两人站在桥上，决定重新开始。`;
const STORAGE_KEY = 'alittlemovie-project-v2';
const MONTHLY_BUDGET = 100;

type Shot = {
  id: string; title: string; description: string; duration: number;
  status: 'draft' | 'ready'; makeVideo?: boolean;
  hasDialog?: boolean; isKeyMoment?: boolean;
  storyboardPrompt?: string; videoPrompt?: string;
};
type Scene = { id: string; name: string; shots: Shot[] };
type Character = { id: string; name: string; description: string; look?: string; fullPrompt?: string };
type Project = {
  name: string; script: string; scenes: Scene[];
  characterNotes?: string; visualStyle?: string;
  monthlySpent?: number; videoPricePerSecond?: number;
  characters?: Character[];
};

export default function Home() {
  const [projectName, setProjectName] = useState('雨夜重逢');
  const [script, setScript] = useState(sampleScript);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterNotes, setCharacterNotes] = useState('女主：年轻女性，黑色长发，米色风衣，手持旧照片。\n男主：年轻男性，深色短发，深蓝色外套，气质克制。');
  const [visualStyle, setVisualStyle] = useState('电影感写实，柔和自然光，低饱和青蓝色调，细腻情绪，竖屏 9:16');
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [videoPricePerSecond, setVideoPricePerSecond] = useState(0.6);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [batchDuration, setBatchDuration] = useState(6);
  const [showShotPrompts, setShowShotPrompts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const project = JSON.parse(stored) as Project;
      setProjectName(project.name || '未命名短剧'); setScript(project.script || sampleScript);
      setScenes(Array.isArray(project.scenes) ? project.scenes : []);
      setCharacterNotes(project.characterNotes ?? ''); setVisualStyle(project.visualStyle ?? '');
      setMonthlySpent(project.monthlySpent ?? 0); setVideoPricePerSecond(project.videoPricePerSecond ?? 0.6);
      if (project.characters) setCharacters(project.characters);
      setSaved(true);
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  const allShots = useMemo(() => scenes.flatMap((scene) => scene.shots), [scenes]);
  const shotCount = allShots.length;
  const selectedShots = allShots.filter((s) => s.makeVideo);
  const totalDuration = allShots.reduce((total, shot) => total + shot.duration, 0);
  const plannedVideoSeconds = selectedShots.reduce((total, shot) => total + shot.duration, 0);
  const plannedVideoCost = plannedVideoSeconds * videoPricePerSecond;
  const remainingBudget = Math.max(0, MONTHLY_BUDGET - monthlySpent);
  const availableSeconds = videoPricePerSecond > 0 ? Math.floor(remainingBudget / videoPricePerSecond) : 0;
  const overBudget = plannedVideoCost > remainingBudget;

  const markChanged = () => setSaved(false);
  const updateShot = (sceneId: string, shotId: string, changes: Partial<Shot>) => {
    setScenes((current) => current.map((scene) => scene.id !== sceneId ? scene : {
      ...scene, shots: scene.shots.map((shot) => shot.id === shotId ? { ...shot, ...changes } : shot),
    })); markChanged();
  };

  // ====== Batch Operations ======
  const selectAll = (val: boolean) => {
    setScenes((current) => current.map((scene) => ({ ...scene,
      shots: scene.shots.map((shot) => ({ ...shot, makeVideo: val })),
    }))); markChanged();
  };

  const selectDialogs = () => {
    setScenes((current) => current.map((scene) => ({ ...scene,
      shots: scene.shots.map((shot) => ({ ...shot, makeVideo: Boolean(shot.hasDialog) })),
    }))); markChanged();
    setNotice('已仅选所有对白镜头。');
  };

  const selectKeyMoments = () => {
    setScenes((current) => current.map((scene) => ({ ...scene,
      shots: scene.shots.map((shot) => ({ ...shot, makeVideo: Boolean(shot.isKeyMoment || shot.hasDialog) })),
    }))); markChanged();
    setNotice('已选所有关键镜头（对白+甜点时刻）。');
  };

  const cancelAll = () => { selectAll(false); setNotice('已取消全部勾选。'); };

  const batchSetDuration = () => {
    setScenes((current) => current.map((scene) => ({ ...scene,
      shots: scene.shots.map((shot) => ({ ...shot, duration: batchDuration })),
    }))); markChanged();
    setNotice(`所有镜头时长已统一设为 ${batchDuration}s。`);
  };

  // ====== Import with character detection ======
  const importDirectorManual = async (file: File) => {
    setIsLoading(true); setNotice('');
    try {
      const text = await file.text();
      const response = await fetch('/api/parse-director-manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markdown: text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '导演手册解析失败。');

      // Update script text with imported markdown
      setScript(text);

      const episodes = data.summary?.episodeTitle || '';
      setProjectName(episodes || file.name.replace(/\.(md|MD)$/, ''));

      // Auto-set characters
      if (data.characters?.length > 0) {
        setCharacters(data.characters);
        const charLines = data.characters.map((c: Character) =>
          `${c.name}：${c.description}` + (c.look ? `（${c.look}）` : '')
        );
        setCharacterNotes(charLines.join('\n'));
      }

      // Auto-set visual style
      if (data.visualStyle) setVisualStyle(data.visualStyle);

      // Set scenes
      setScenes((data.scenes ?? []).map((scene: Scene) => ({
        ...scene,
        shots: scene.shots.map((shot: any) => ({
          id: shot.id || `shot-${Math.random().toString(36).slice(2, 9)}`,
          title: shot.title || '镜头',
          description: shot.description || '',
          duration: shot.duration || 5,
          status: 'draft' as const,
          makeVideo: Boolean(shot.hasDialog),
          hasDialog: shot.hasDialog,
          isKeyMoment: shot.isKeyMoment,
          storyboardPrompt: shot.storyboardPrompt,
          videoPrompt: shot.videoPrompt,
        })),
      })));
      markChanged();
      const autoSelected = allShots.filter(s => s.hasDialog).length;
      setNotice(`已导入「${episodes}」：${data.summary?.totalShots || 0} 个镜头，${data.characters?.length || 0} 个角色，${autoSelected} 个对白镜头已自动勾选。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '导入失败。'); }
    finally { setIsLoading(false); }
  };

  const parseScript = async () => {
    setIsLoading(true); setNotice('');
    try {
      const response = await fetch('/api/parse-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '剧本解析失败，请重试。');
      setScenes((data.scenes ?? []).map((scene: Scene) => ({ ...scene,
        shots: scene.shots.map((shot) => ({ ...shot, makeVideo: false, hasDialog: undefined, isKeyMoment: undefined })),
      })));
      markChanged(); setNotice('分镜已生成。默认采用静帧方案；只勾选关键动作镜头生成视频，控制花费。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '发生未知错误。'); }
    finally { setIsLoading(false); }
  };

  const saveProject = () => {
    const project: Project & { characters?: Character[] } = { name: projectName, script, scenes, characterNotes, visualStyle, monthlySpent, videoPricePerSecond, characters };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaved(true); setNotice('项目已保存在当前浏览器。'); }
    catch { setNotice('浏览器存储空间不足，请先导出项目备份。'); }
  };

  const exportProject = () => {
    const project: any = { name: projectName, script, scenes, characterNotes, visualStyle, monthlySpent, videoPricePerSecond, characters,
      budget: { monthlyLimitRmb: MONTHLY_BUDGET, plannedVideoSeconds, estimatedPlannedVideoCostRmb: Number(plannedVideoCost.toFixed(2)), remainingRmb: Number(remainingBudget.toFixed(2)) },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${projectName || 'alittlemovie-project'}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('项目方案已导出为 JSON。');
  };

  const copyText = async (text: string, success: string) => {
    try { await navigator.clipboard.writeText(text); setNotice(success); }
    catch { setNotice(`无法自动复制，请手动复制：\n${text}`); }
  };
  const characterPrompt = `请为短剧设计角色参考图。角色设定：\n${characterNotes || characters.map(c => `${c.name}: ${c.description}`).join('\n')}\n统一视觉风格：${visualStyle}\n请生成清晰、稳定、便于后续镜头复用的角色设定图，包含正面全身、半身和面部特写；保持服装、发型、年龄特征一致。`;

  const copyCharPrompt = (char: Character) => {
    copyText(char.fullPrompt || `${char.name}: ${char.description}\n视觉风格: ${visualStyle}`, `${char.name}提示词已复制。`);
  };

  const copyShotPrompt = (shot: Shot) => {
    const prompt = shot.videoPrompt || shot.storyboardPrompt || `${shot.description}\n${visualStyle}\n竖屏 9:16，时长约 ${shot.duration} 秒。`;
    copyText(prompt, '提示词已复制。');
  };

  const flipShotPrompt = (shotId: string) => {
    setShowShotPrompts((prev) => ({ ...prev, [shotId]: !prev[shotId] }));
  };

  // Count how many shots have dialog/key moments for UI display
  const dialogCount = allShots.filter((s) => s.hasDialog).length;
  const keyCount = allShots.filter((s) => s.isKeyMoment).length;

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Alittlemovie 首页"><span className="brand-mark">A</span>alittlemovie</a>
        <p className="sidebar-label">创作空间</p>
        <nav aria-label="主导航">
          <a className="nav-item active" href="#script">✦ <span>剧本工作台</span></a>
          <a className="nav-item" href="#characters">◉ <span>角色工作室</span></a>
          <a className="nav-item" href="#storyboard">▤ <span>分镜故事板</span></a>
          <a className="nav-item" href="#budget">￥ <span>预算计划</span></a>
        </nav>
        <div className="sidebar-note"><span className="status-dot" /> 本地草稿模式<p>仅存于当前浏览器</p></div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">独立创作者 · 100 元月预算方案</p>
            <h1>把灵感，拍成一部短剧。</h1>
            <p className="subtitle">导入导演手册或编写剧本，自动识别角色；一键勾选关键镜头，精准预算。</p>
          </div>
          <div className="top-actions">
            <button className="secondary-btn" onClick={saveProject}>💾 保存草稿</button>
            <button className="primary-btn" onClick={exportProject}>📦 导出方案</button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            <span>✦</span>
            <span className="notice-text">{notice}</span>
            <button onClick={() => setNotice('')} aria-label="关闭提示">×</button>
          </div>
        )}

        {/* ===== BUDGET SECTION ===== */}
        <section className="budget-summary panel" id="budget">
          <div className="budget-title"><span className="budget-icon">￥</span><div><h2>本月生成预算</h2><p>建议分配：角色/场景参考图 ¥20 · 重点动态镜头 ¥60 · 重试预留 ¥20</p></div></div>
          <div className="budget-controls">
            <label>已花费 ¥<input type="number" min="0" max="100" step="1" value={monthlySpent} onChange={(event) => { setMonthlySpent(Math.min(100, Math.max(0, Number(event.target.value) || 0))); markChanged(); }} aria-label="本月已花费金额" /></label>
            <label>视频估算 ¥/秒<input type="number" min="0.01" step="0.01" value={videoPricePerSecond} onChange={(event) => { setVideoPricePerSecond(Math.max(0.01, Number(event.target.value) || 0.01)); markChanged(); }} aria-label="视频每秒估算价格" /></label>
          </div>
          <div className="budget-metrics">
            <div><span>剩余预算</span><b>¥{remainingBudget.toFixed(2)}</b></div>
            <div><span>可购视频时长</span><b>约 {availableSeconds} 秒</b></div>
            <div className={overBudget ? 'metric-warning' : ''}>
              <span>已选 {selectedShots.length}/{shotCount} 镜头</span>
              <b>¥{plannedVideoCost.toFixed(2)} / {plannedVideoSeconds}s</b>
            </div>
          </div>
          <p className="budget-disclaimer">价格仅为你可编辑的估算值（默认 ¥0.60/秒，不代表任何服务商报价）。</p>
        </section>

        {/* ===== CHARACTER STUDIO ===== */}
        <section className="panel character-panel" id="characters">
          <div className="panel-heading">
            <div><span className="step">00</span><div><h2>角色工作室</h2><p>先确定可复用的角色描述和背景风格（导入导演手册会自动识别角色）</p></div></div>
            <button className="text-btn" onClick={() => copyText(characterPrompt, '角色设定提示词已复制。')}>📋 复制全部角色提示词</button>
          </div>

          {/* Detected character cards */}
          {characters.length > 0 && (
            <div className="character-cards">
              {characters.map((char) => (
                <div className="char-card" key={char.id}>
                  <div className="char-card-header">
                    <span className="char-avatar">{char.name[0]}</span>
                    <div>
                      <strong>{char.name}</strong>
                      <span className="char-look">{char.look || char.description}</span>
                    </div>
                    <button className="text-btn" onClick={() => copyCharPrompt(char)} title="复制此角色提示词">📋</button>
                  </div>
                  {char.fullPrompt && (
                    <details className="char-details">
                      <summary>查看角色提示词</summary>
                      <pre>{char.fullPrompt.substring(0, 500)}{char.fullPrompt.length > 500 ? '…' : ''}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="character-grid" style={characters.length > 0 ? { borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 8 } : {}}>
            <label>人物细节描述<textarea value={characterNotes} rows={4} onChange={(event) => { setCharacterNotes(event.target.value); markChanged(); }} placeholder="例如：年龄、发型、服装、气质、人物关系" /></label>
            <label>统一画面风格<textarea value={visualStyle} rows={4} onChange={(event) => { setVisualStyle(event.target.value); markChanged(); }} placeholder="例如：电影感写实、光线、色彩、画幅" /></label>
          </div>
          <p className="character-tip">建议先用免费额度或已有工具制作角色参考图和场景图，人工挑选满意版本后再复用；上方角色卡在导入导演手册后自动生成。</p>
        </section>

        {/* ===== PROJECT BAR ===== */}
        <section className="project-bar panel">
          <div className="project-icon">▶</div>
          <label className="project-name-label">项目名称<input value={projectName} onChange={(event) => { setProjectName(event.target.value); markChanged(); }} aria-label="项目名称" /></label>
          <div className="project-stats">
            <span><b>{scenes.length}</b> 场景</span><i /><span><b>{shotCount}</b> 镜头</span><i /><span><b>{totalDuration}</b> 秒</span>
            {dialogCount > 0 && <><i /><span className="stat-tag">🗣 <b>{dialogCount}</b></span></>}
            {keyCount > 0 && <><i /><span className="stat-tag">★ <b>{keyCount}</b></span></>}
          </div>
          <span className={`save-state ${saved ? 'is-saved' : ''}`}>{saved ? '● 已保存' : '○ 未保存'}</span>
        </section>

        {/* ===== CONTENT GRID ===== */}
        <div className="content-grid">

          {/* SCRIPT PANEL */}
          <section className="panel script-panel" id="script">
            <div className="panel-heading"><div><span className="step">01</span><div><h2>你的剧本</h2><p>粘贴剧本或导入导演手册 Markdown</p></div></div><span className="ai-tag">免费 · 规则拆分</span></div>
            <textarea value={script} onChange={(event) => { setScript(event.target.value); markChanged(); }} rows={15} maxLength={50000} placeholder="在这里粘贴你的故事梗概或剧本……" aria-label="剧本内容" />
            <div className="editor-footer">
              <span>{script.length.toLocaleString()} / 50,000 字符</span>
              <div style={{display:'flex',gap:8}}>
                <label className="secondary-btn" style={{cursor:'pointer',padding:'10px 16px',display:'inline-flex',alignItems:'center',fontSize:12}}>
                  📋 导入导演手册
                  <input type="file" accept=".md,.MD" style={{display:'none'}} onChange={(e)=>{const f=e.target.files?.[0];if(f)importDirectorManual(f);e.target.value=''}} />
                </label>
                <button className="primary-btn" onClick={parseScript} disabled={isLoading || !script.trim()}>
                  {isLoading ? <><span className="spinner" /> 正在拆解…</> : '✦ 拆解成分镜'}
                </button>
              </div>
            </div>
            <div className="tip"><span>✦</span><p><b>导演手册导入：</b>自动识别角色并填充到角色工作室，自动勾选对白镜头，标注关键甜点时刻。</p></div>
          </section>

          {/* STORYBOARD PANEL */}
          <section className="panel storyboard-panel" id="storyboard">
            <div className="panel-heading">
              <div><span className="step">02</span><div><h2>分镜与动态镜头计划</h2><p>默认自动勾选对白镜头；管理哪些镜头做视频</p></div></div>
              <span className="count-pill">{shotCount} 镜头</span>
            </div>

            {/* Quick Action Toolbar */}
            {shotCount > 0 && (
              <div className="shot-toolbar">
                <span className="toolbar-label">快捷操作：</span>
                <button className="mini-btn primary-mini" onClick={() => selectAll(true)}>✅ 全选</button>
                <button className="mini-btn" onClick={cancelAll}>⬜ 取消全选</button>
                {dialogCount > 0 && <button className="mini-btn accent-mini" onClick={selectDialogs}>🗣 仅选对白 ({dialogCount})</button>}
                {keyCount > 0 && <button className="mini-btn accent2-mini" onClick={selectKeyMoments}>★ 选关键镜 ({keyCount})</button>}
                <span className="toolbar-sep" />
                <span className="toolbar-label">统一时长：</span>
                <input className="mini-input" type="number" min={1} max={30} value={batchDuration} onChange={(e) => setBatchDuration(Math.max(1, Number(e.target.value) || 1))} />
                <button className="mini-btn" onClick={batchSetDuration}>应用</button>
                {selectedShots.length > 0 && <span className="toolbar-summary">已选 {selectedShots.length}/{shotCount}，估算 ¥{plannedVideoCost.toFixed(2)}</span>}
              </div>
            )}

            <div className="scene-list">
              {scenes.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▧</div>
                  <h3>故事板还空着</h3>
                  <p>导入导演手册或拆解剧本后，在这里规划静帧和动态镜头。</p>
                  <span>先做角色参考图，再生成关键镜头</span>
                </div>
              ) : scenes.map((scene, sceneIndex) => (
                <article className="scene-card" key={scene.id}>
                  <div className="scene-heading">
                    <span className="scene-number">{String(sceneIndex + 1).padStart(2, '0')}</span>
                    <h3>{scene.name}</h3>
                    <span className="scene-shot-count">{scene.shots.filter(s=>s.makeVideo).length}/{scene.shots.length} 已选</span>
                    <button className="mini-btn" onClick={() => {
                      const allSelected = scene.shots.every(s => s.makeVideo);
                      setScenes(prev => prev.map(s => s.id !== scene.id ? s : {
                        ...s, shots: s.shots.map(sh => ({ ...sh, makeVideo: !allSelected })),
                      })); markChanged();
                    }}>
                      {scene.shots.every(s => s.makeVideo) ? '取消本组' : '全选本组'}
                    </button>
                  </div>
                  <div className="shot-stack">
                    {scene.shots.map((shot, shotIndex) => (
                      <div className={`shot-card ${shot.makeVideo ? 'video-planned' : ''}`} key={shot.id}>
                        <div className="shot-topline">
                          <span className="shot-number">{String(shotIndex + 1).padStart(2, '0')}</span>
                          <span className="shot-label">{shot.title}</span>
                          {shot.hasDialog && <span className="shot-badge dialog-badge">🗣 对白</span>}
                          {shot.isKeyMoment && !shot.hasDialog && <span className="shot-badge key-badge">★ 关键</span>}
                          <label className="duration-control">时长 <input type="number" min="1" max="30" value={shot.duration} onChange={(event) => updateShot(scene.id, shot.id, { duration: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} /> 秒</label>
                        </div>
                        <textarea className="shot-description" value={shot.description} rows={2} onChange={(event) => updateShot(scene.id, shot.id, { description: event.target.value })} aria-label={`${shot.title}描述`} />

                        {/* Show prompt preview if available */}
                        {(shot.storyboardPrompt || shot.videoPrompt) && (
                          <details className="shot-prompt-details" open={Boolean(showShotPrompts[shot.id])}>
                            <summary onClick={(e) => { e.preventDefault(); flipShotPrompt(shot.id); }}>
                              {showShotPrompts[shot.id] ? '收起提示词 ▲' : '查看提示词 ▼'}
                            </summary>
                            {shot.storyboardPrompt && <div className="prompt-block"><span className="prompt-label">分镜图提示词</span><pre>{shot.storyboardPrompt.substring(0, 400)}{shot.storyboardPrompt.length > 400 ? '…' : ''}</pre></div>}
                            {shot.videoPrompt && <div className="prompt-block"><span className="prompt-label">视频提示词</span><pre>{shot.videoPrompt.substring(0, 400)}{shot.videoPrompt.length > 400 ? '…' : ''}</pre></div>}
                          </details>
                        )}

                        <div className="shot-actions">
                          <label className="video-toggle">
                            <input type="checkbox" checked={Boolean(shot.makeVideo)} onChange={(event) => updateShot(scene.id, shot.id, { makeVideo: event.target.checked })} />
                            动态镜头 <span>≈ ¥{(shot.duration * videoPricePerSecond).toFixed(2)}</span>
                          </label>
                          <button className="text-btn" onClick={() => copyShotPrompt(shot)}>复制提示词 ↗</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            {overBudget && <p className="budget-warning">⚠ 已选动态镜头超出剩余预算。取消部分勾选或调整时长。</p>}
          </section>
        </div>

        <section className="generation-panel panel">
          <div className="generation-icon">✧</div>
          <div className="generation-copy">
            <h2>生成方式：先定妆，后拍关键镜头</h2>
            <p>当前版本不调用视频供应商、不扣费。对白镜头和关键甜点时刻优先做视频，静帧镜头用参考图即可。</p>
          </div>
          <span className="coming-soon">手动生成 · 零 API 费用</span>
        </section>
        <footer className="footer-note">Alittlemovie Studio <span>·</span> 草稿保存在当前浏览器，清理浏览器数据前请先导出备份</footer>
      </section>
    </main>
  );
}