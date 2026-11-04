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

type Shot = { id: string; title: string; description: string; duration: number; status: 'draft' | 'ready'; makeVideo?: boolean; characters?: string[] };
type Scene = { id: string; name: string; shots: Shot[] };
type Project = { name: string; script: string; scenes: Scene[]; characterNotes?: string; visualStyle?: string; monthlySpent?: number; videoPricePerSecond?: number; characterImages?: Record<string, string> };

export default function Home() {
  const [projectName, setProjectName] = useState('雨夜重逢');
  const [script, setScript] = useState(sampleScript);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characterNotes, setCharacterNotes] = useState('女主：年轻女性，黑色长发，米色风衣，手持旧照片。\n男主：年轻男性，深色短发，深蓝色外套，气质克制。');
  const [visualStyle, setVisualStyle] = useState('电影感真人写实，柔和电影光，自然肤色，电影级调色，细腻情绪');
  const [monthlySpent, setMonthlySpent] = useState(0);
  const [videoPricePerSecond, setVideoPricePerSecond] = useState(0.6);
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({});
  const [castAccessCode, setCastAccessCode] = useState('');
  const [castGenBusy, setCastGenBusy] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const project = JSON.parse(stored) as Project;
      setProjectName(project.name || '未命名短剧'); setScript(project.script || sampleScript);
      setScenes(Array.isArray(project.scenes) ? project.scenes : []);
      setCharacterNotes(project.characterNotes ?? ''); setVisualStyle(project.visualStyle ?? '');
      setMonthlySpent(project.monthlySpent ?? 0); setVideoPricePerSecond(project.videoPricePerSecond ?? 0.6);
      setCharacterImages(project.characterImages ?? {});
      setSaved(true);
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  useEffect(() => {
    const code = sessionStorage.getItem('alittlemovie-access-code');
    if (code) setCastAccessCode(code);
  }, []);

  const allShots = useMemo(() => scenes.flatMap((scene) => scene.shots), [scenes]);
  const shotCount = allShots.length;
  const totalDuration = allShots.reduce((total, shot) => total + shot.duration, 0);
  const plannedVideoSeconds = allShots.filter((shot) => shot.makeVideo).reduce((total, shot) => total + shot.duration, 0);
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

  const parseScript = async () => {
    setIsLoading(true); setNotice('');
    try {
      const response = await fetch('/api/parse-script', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '剧本解析失败，请重试。');
      setScenes((data.scenes ?? []).map((scene: Scene) => ({ ...scene, shots: scene.shots.map((shot) => ({ ...shot, makeVideo: false })) })));
      markChanged(); setNotice('分镜已生成。默认采用静帧方案；只勾选关键动作镜头生成视频，控制花费。');
    } catch (error) { setNotice(error instanceof Error ? error.message : '发生未知错误。'); }
    finally { setIsLoading(false); }
  };

  const importDemo = async (ep: number) => {
    setIsLoading(true); setNotice('');
    try {
      const fileName = ep === 1 ? '/demo-ep01.json' : `/ep${String(ep).padStart(2, '0')}.json`;
      const response = await fetch(fileName);
      if (!response.ok) throw new Error(`第${ep}集示例项目加载失败，请确认文件存在。`);
      const demo = await response.json();
      const loaded = (demo.scenes ?? []).map((scene: Scene) => ({
        ...scene,
        shots: (scene.shots ?? []).map((shot: Shot) => ({ ...shot, makeVideo: false })),
      }));
      if (!loaded.length) throw new Error('示例项目没有可导入的镜头。');
      setProjectName(demo.name || `闪婚老公掉马甲·第${ep}集`);
      setScript(demo.script ?? script);
      setScenes(loaded);
      setCharacterNotes(demo.characterNotes ?? characterNotes);
      setVisualStyle(demo.visualStyle ?? visualStyle);
      setMonthlySpent(demo.monthlySpent ?? 0);
      setVideoPricePerSecond(demo.videoPricePerSecond ?? 0.6);
      setCharacterImages(demo.characterImages ?? {});
      markChanged();
      setNotice(`已导入「${demo.name}」：${loaded.length} 个场景、${loaded.reduce((n: number, s: Scene) => n + s.shots.length, 0)} 个镜头。请在分镜区勾选要生成的镜头，再点右下角「去生成视频」。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '导入失败。'); }
    finally { setIsLoading(false); }
  };

  const saveProject = () => {
    const project: Project = { name: projectName, script, scenes, characterNotes, visualStyle, monthlySpent, videoPricePerSecond, characterImages };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaved(true); setNotice('项目已保存在当前浏览器。'); }
    catch { setNotice('浏览器存储空间不足，请先导出项目备份。'); }
  };

  const exportProject = () => {
    const project: Project & { budget: object; exportedAt: string } = {
      name: projectName, script, scenes, characterNotes, visualStyle, monthlySpent, videoPricePerSecond, characterImages,
      budget: { monthlyLimitRmb: MONTHLY_BUDGET, plannedVideoSeconds, estimatedPlannedVideoCostRmb: Number(plannedVideoCost.toFixed(2)), remainingRmb: Number(remainingBudget.toFixed(2)) },
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${projectName || 'alittlemovie-project'}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('项目方案已导出为 JSON。导出的是规划数据，不是生成的视频。');
  };

  const copyText = async (text: string, success: string) => {
    try { await navigator.clipboard.writeText(text); setNotice(success); }
    catch { setNotice(`无法自动复制，请手动复制：\n${text}`); }
  };
  const characterPrompt = `请为短剧设计角色参考图。角色设定：\n${characterNotes}\n统一视觉风格：${visualStyle}\n请生成清晰、稳定、便于后续镜头复用的角���设定图，包含正面全身、半身和面部特写；保持服装、发型、年龄特征一致。`;
  const copyShotPrompt = (shot: Shot) => copyText(`${shot.description}\n${visualStyle}\n竖屏 9:16，时长约 ${shot.duration} 秒。严格保持角色参考图中的脸、发型和服装一致。${shot.makeVideo ? '生成自然连贯的微动作与镜头运动，避免切换人物外观。' : '生成高质量电影感静帧，适合作为带缓慢推拉运镜的分镜画面。'}`, '提示词已复制。');

  // 从分镜中收集出场角色，用于定妆图管理
  const castList = useMemo(() => {
    const set = new Set<string>();
    scenes.forEach((scene) => scene.shots.forEach((shot) => (shot.characters ?? []).forEach((c) => set.add(c))));
    return Array.from(set);
  }, [scenes]);

  const characterImagePrompt = (name: string) => {
    const line = characterNotes.split('\n').find((l) => l.includes(name));
    const desc = line ? line.replace(/^[^:：]*[：:]\s*/, '').trim() : '';
    return `电影感真人写实角色定妆图，${name}${desc ? '，' + desc : ''}。正面半身，面部清晰，柔和均匀影棚光，中性浅灰纯色背景，超高清，真实皮肤纹理与发丝细节，无文字，无水印`;
  };

  const setCharacterImage = (name: string, url: string) => {
    setCharacterImages((cur) => ({ ...cur, [name]: url.trim() }));
    markChanged();
  };

  // 在站内直接生成定妆图（调用 MiniMax 文生图）
  const generateCharacterImage = async (name: string) => {
    const code = castAccessCode.trim();
    if (!code) { setNotice('请先在「角色定妆图」区填写服务端访问码（与生成视频同一个码）。'); return; }
    sessionStorage.setItem('alittlemovie-access-code', code);
    setCastGenBusy(name);
    try {
      const response = await fetch('/api/image-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-alittlemovie-access-code': code },
        body: JSON.stringify({ prompt: characterImagePrompt(name) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '定妆图生成失败。');
      const url = data.imageUrls?.[0];
      if (!url) throw new Error('服务商未返回图片地址。');
      setCharacterImage(name, url);
      setNotice(`${name} 定妆图已生成并填入。注意：图片链接 24 小时内有效，请尽快生成视频或转存。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '定妆图生成失败。');
    } finally {
      setCastGenBusy('');
    }
  };

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="#workspace" aria-label="Alittlemovie 首页"><span className="brand-mark">A</span>alittlemovie</a>
        <p className="sidebar-label">创作空间</p>
        <nav aria-label="主导航"><a className="nav-item active" href="#script">✦ <span>剧本工作台</span></a><a className="nav-item" href="#characters">◉ <span>角色与风格</span></a><a className="nav-item" href="#storyboard">▤ <span>分镜故事板</span></a><a className="nav-item" href="#budget">￥ <span>预算计划</span></a></nav>
        <div className="sidebar-note"><span className="status-dot" /> 本地草稿模式<p>仅存于当前浏览器</p></div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar"><div><p className="eyebrow">独立创作者 · 100 元月预算方案</p><h1>把灵感，拍成一部短剧。</h1><p className="subtitle">先定角色与视觉，再逐镜规划；把有限预算留给最重要的动态镜头。</p></div><div className="top-actions"><button className="secondary-btn" onClick={saveProject}>保存草稿</button><button className="primary-btn" onClick={exportProject}>导出方案</button></div></header>
        {notice && <div className="notice" role="status"><span>✦</span><span className="notice-text">{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}

        <section className="budget-summary panel" id="budget">
          <div className="budget-title"><span className="budget-icon">￥</span><div><h2>本月生成预算</h2><p>建议分配：角色/场景参考图 ¥20 · 重点动态镜头 ¥60 · 重试预留 ¥20</p></div></div>
          <div className="budget-controls"><label>已花费 ¥<input type="number" min="0" max="100" step="1" value={monthlySpent} onChange={(event) => { setMonthlySpent(Math.min(100, Math.max(0, Number(event.target.value) || 0))); markChanged(); }} aria-label="本月已花费金额" /></label><label>视频估算 ¥/秒<input type="number" min="0.01" step="0.01" value={videoPricePerSecond} onChange={(event) => { setVideoPricePerSecond(Math.max(0.01, Number(event.target.value) || 0.01)); markChanged(); }} aria-label="视频每秒估算价格" /></label></div>
          <div className="budget-metrics"><div><span>剩余预算</span><b>¥{remainingBudget.toFixed(2)}</b></div><div><span>可购视频时长估算</span><b>约 {availableSeconds} 秒</b></div><div className={overBudget ? 'metric-warning' : ''}><span>已勾选动态镜头估算</span><b>¥{plannedVideoCost.toFixed(2)} / {plannedVideoSeconds} 秒</b></div></div>
          <p className="budget-disclaimer">价格仅为你可编辑的估算值（默认 ¥0.60/秒，不代表任何服务商报价）。正式生成前请核对平台实时价格；此处不调用 API、不产生费用。</p>
        </section>

        <section className="panel character-panel" id="characters"><div className="panel-heading"><div><span className="step">00</span><div><h2>角色与视觉设定</h2><p>先确定可复用的角色描述和背景风格，减少镜头漂移</p></div></div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><select className="ep-select" defaultValue="1" onChange={(e) => void importDemo(Number(e.target.value))} disabled={isLoading} aria-label="选择要导入的集数"><option value="1">第01集《走错桌》</option><option value="2">第02集《领证》</option><option value="3">第03集《搬进来》</option><option value="4">第04集《婚姻协议》</option><option value="5">第05集《念念甜品》</option><option value="6">第06集《她是我妻子》</option><option value="7">第07集《同屋檐下》</option><option value="8">第08集《心动》</option><option value="9">第09集《挡酒》</option><option value="10">第10集《旧伤》</option><option value="11">第11集《曝光危机》</option><option value="12">第12集《云舒窈》</option><option value="13">第13集《同框》</option><option value="14">第14集《霍太太》</option><option value="15">第15集《不示弱》</option><option value="16">第16集《甜点大赛》</option><option value="17">第17集《生日》</option><option value="18">第18集《挑拨》</option><option value="19">第19集《误会》</option><option value="20">第20集《掉马》</option></select><button className="text-btn" onClick={() => copyText(characterPrompt, '角色设定提示词已复制，可在你选择的图片生成工具中制作参考图。')}>复制角色设定提示词 ↗</button></div></div><div className="character-grid"><label>人物大致形象<textarea value={characterNotes} rows={4} onChange={(event) => { setCharacterNotes(event.target.value); markChanged(); }} placeholder="例如：年龄、发型、服装、气质、人物关系" /></label><label>统一画面风格<textarea value={visualStyle} rows={4} onChange={(event) => { setVisualStyle(event.target.value); markChanged(); }} placeholder="例如：电影感写实、光线、色彩、画幅" /></label></div><p className="character-tip">建议先用免费额度或已有工具制作角色正面/半身参考图和场景图，人工挑选满意版本后再复用；本页面只生成提示词，不会实际生成图片。</p>{castList.length > 0 && <div className="cast-manager"><div className="panel-heading"><div><h2 style={{ margin: 0, fontSize: 12 }}>角色定妆图（首帧参考）</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 10 }}>点「生成」直接在站内用 AI 文生图（服务端 `IMAGE_PROVIDER` 可切换 MiniMax / LibTV 角色模型）做出定妆图并自动填入；也可手动粘贴 HTTPS 链接。生成视频时自动用对应角色定妆图作首帧。</p></div></div><div className="cast-access"><label>服务端访问码<input type="password" autoComplete="current-password" value={castAccessCode} onChange={(e) => setCastAccessCode(e.target.value)} placeholder="与生成视频同一个访问码" /></label></div><div className="cast-list">{castList.map((name) => <div className="cast-row" key={name}><div className="cast-name">{name}</div><div className="cast-actions"><button className="primary-btn cast-gen-btn" onClick={() => void generateCharacterImage(name)} disabled={Boolean(castGenBusy)}>{castGenBusy === name ? '生成中…' : '生成定妆图'}</button><button className="text-btn" onClick={() => copyText(characterImagePrompt(name), `${name}定妆图提示词已复制。`)}>复制提示词</button><input type="url" value={characterImages[name] ?? ''} onChange={(e) => setCharacterImage(name, e.target.value)} placeholder={`${name} 定妆图 HTTPS 链接`} aria-label={`${name}定妆图链接`} />{characterImages[name]?.trim() && <span className="cast-preview" style={{ backgroundImage: `url(${characterImages[name]})` }} role="img" aria-label={`${name}定妆图`} />}</div></div>)}</div></div>}</section>

        <section className="project-bar panel"><div className="project-icon">▶</div><label className="project-name-label">项目名称<input value={projectName} onChange={(event) => { setProjectName(event.target.value); markChanged(); }} aria-label="项目名称" /></label><div className="project-stats"><span><b>{scenes.length}</b> 场景</span><i /><span><b>{shotCount}</b> 镜头</span><i /><span><b>{totalDuration}</b> 秒故事板</span></div><span className={`save-state ${saved ? 'is-saved' : ''}`}>{saved ? '● 已保存' : '○ 未保存'}</span></section>

        <div className="content-grid">
          <section className="panel script-panel" id="script"><div className="panel-heading"><div><span className="step">01</span><div><h2>你的剧本</h2><p>按空行或场景标题拆分段落</p></div></div><span className="ai-tag">免费 · 规则拆分</span></div><textarea value={script} onChange={(event) => { setScript(event.target.value); markChanged(); }} rows={15} maxLength={50000} placeholder="在这里粘贴你的故事梗概或剧本……" aria-label="剧本内容" /><div className="editor-footer"><span>{script.length.toLocaleString()} / 50,000 字符</span><button className="primary-btn" onClick={parseScript} disabled={isLoading || !script.trim()}>{isLoading ? <><span className="spinner" /> 正在拆解…</> : '✦ 拆解成分镜'}</button></div><div className="tip"><span>✦</span><p><b>省预算原则：</b>先审核分镜和提示词，不满意先改文案，不要直接反复生成视频。</p></div></section>

          <section className="panel storyboard-panel" id="storyboard"><div className="panel-heading"><div><span className="step">02</span><div><h2>分镜与动态镜头计划</h2><p>默认静帧；仅勾选关键动作镜头计入动态预算</p></div></div><span className="count-pill">{shotCount} 镜头</span></div><div className="scene-list">{scenes.length === 0 ? <div className="empty-state"><div className="empty-icon">▧</div><h3>故事板还空着</h3><p>拆解剧本后，在这里规划静帧和重点动态镜头。</p><span>先做角色参考图，再生成关键镜头</span></div> : scenes.map((scene, sceneIndex) => <article className="scene-card" key={scene.id}><div className="scene-heading"><span className="scene-number">SCENE {String(sceneIndex + 1).padStart(2, '0')}</span><h3>{scene.name}</h3><span className="scene-shot-count">{scene.shots.length} 镜头</span></div><div className="shot-stack">{scene.shots.map((shot, shotIndex) => <div className={`shot-card ${shot.makeVideo ? 'video-planned' : ''}`} key={shot.id}><div className="shot-topline"><span className="shot-number">{String(shotIndex + 1).padStart(2, '0')}</span><span className="shot-label">镜头描述</span><label className="duration-control">时长 <input type="number" min="1" max="30" value={shot.duration} onChange={(event) => updateShot(scene.id, shot.id, { duration: Math.min(30, Math.max(1, Number(event.target.value) || 1)) })} /> 秒</label></div><textarea className="shot-description" value={shot.description} rows={2} onChange={(event) => updateShot(scene.id, shot.id, { description: event.target.value })} aria-label={`${shot.title}描述`} /><div className="shot-actions"><label className="video-toggle"><input type="checkbox" checked={Boolean(shot.makeVideo)} onChange={(event) => updateShot(scene.id, shot.id, { makeVideo: event.target.checked })} /> 重点动态镜头 <span>≈ ¥{(shot.duration * videoPricePerSecond).toFixed(2)}</span></label><button className="text-btn" onClick={() => copyShotPrompt(shot)}>复制{shot.makeVideo ? '视频' : '静帧'}提示词 ↗</button></div></div>)}</div></article>)}</div>{overBudget && <p className="budget-warning">⚠ 已选动态镜头超出剩余预算。取消部分勾选、缩短时长或调整估算单价后再计划。</p>}</section>
        </div>

        <section className="generation-panel panel"><div className="generation-icon">✧</div><div className="generation-copy"><h2>下一步：生成关键动态镜头</h2><p>勾选“重点动态镜头”并保存草稿后，可连接你自己的 MiniMax API，按 6 秒 / 10 秒镜头真实生成视频。建议先用角色参考图锁定人物一致性，再生成关键镜头。</p></div><a className="primary-btn" href="/generate">▶ 去生成视频</a></section>
        <footer className="footer-note">Alittlemovie Studio <span>·</span> 草稿保存在当前浏览器，清理浏览器数据前请先导出备份</footer>
      </section>
    </main>
  );
}
