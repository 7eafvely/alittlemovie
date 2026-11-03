'use client';

import { useEffect, useMemo, useState } from 'react';

type Shot = {
  id: string; title: string; description: string; duration: number; makeVideo?: boolean;
  hasDialog?: boolean; isKeyMoment?: boolean;
  storyboardPrompt?: string; videoPrompt?: string;
};
type Scene = { id: string; name: string; shots: Shot[] };
type Character = { id: string; name: string; description: string; look?: string; fullPrompt?: string; imageUrl?: string };
type Project = {
  name: string; script: string; scenes: Scene[]; characterNotes?: string; visualStyle?: string;
  monthlySpent?: number; videoPricePerSecond?: number; characters?: Character[];
};
type VideoJob = { shotId: string; taskId: string; status: string; videoUrl?: string | null; error?: string | null; prompt: string; duration: number; estimatedCost: number };

const PROJECT_KEY = 'alittlemovie-project-v2';
const JOBS_KEY = 'alittlemovie-video-jobs-v1';
const TERMINAL = new Set(['succeeded', 'success', 'failed', 'fail', 'cancelled', 'canceled']);

export default function GeneratePage() {
  const [project, setProject] = useState<Project | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [resolution, setResolution] = useState<'768P' | '1080P'>('768P');
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [busyShot, setBusyShot] = useState('');
  const [message, setMessage] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [charImages, setCharImages] = useState<Record<string, string>>({});
  const [generatingChar, setGeneratingChar] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROJECT_KEY);
      if (raw) setProject(JSON.parse(raw) as Project);
      const savedJobs = localStorage.getItem(JOBS_KEY);
      if (savedJobs) setJobs(JSON.parse(savedJobs) as VideoJob[]);
      const code = sessionStorage.getItem('alittlemovie-access-code');
      if (code) setAccessCode(code);
    } catch { setMessage('无法读取本地项目数据，请回工作台重新保存项目。'); }
  }, []);

  useEffect(() => { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs)); }, [jobs]);

  const selectedShots = useMemo(() => (project?.scenes ?? []).flatMap((scene) => scene.shots.map((shot) => ({ ...shot, sceneName: scene.name }))).filter((shot) => shot.makeVideo), [project]);
  const unitPrice = project?.videoPricePerSecond ?? 0.6;
  const remaining = Math.max(0, 100 - (project?.monthlySpent ?? 0));
  const estimatedTotal = selectedShots.reduce((total, shot) => total + shot.duration * unitPrice, 0);
  const characters = project?.characters ?? [];

  // ====== Core: build video prompt from imported director manual ======
  const makePrompt = (shot: Shot) => {
    // Prefer the full director-manual video prompt (script-accurate)
    if (shot.videoPrompt && shot.videoPrompt.trim()) {
      const cleaned = shot.videoPrompt
        .replace(/\{\{Mixed\s*\d+\}\}/g, '')   // remove image placeholders
        .replace(/参考图是\s*/g, '')
        .replace(/资产图锚定：[\s\S]*?---/g, '')
        .replace(/参考图使用规则：[\s\S]*?---/g, '')
        .trim();
      const visual = project?.visualStyle ? `\n[视觉风格：${project.visualStyle}]` : '';
      return cleaned + visual;
    }
    if (shot.storyboardPrompt && shot.storyboardPrompt.trim()) {
      return `${shot.storyboardPrompt}\n[视觉风格：${project?.visualStyle ?? ''}]`;
    }
    // Fallback
    return `${shot.description}\n${project?.characterNotes ? `角色外观：${project.characterNotes}\n` : ''}${project?.visualStyle ?? ''}\n竖屏 9:16。`;
  };

  // MiniMax only accepts 6s or 10s
  const snapDuration = (d: number) => {
    const supported = [6, 10];
    return supported.reduce((best, cur) => Math.abs(cur - d) < Math.abs(best - d) ? cur : best);
  };

  const refreshJob = async (job: VideoJob) => {
    try {
      const response = await fetch(`/api/video-generation/status?taskId=${encodeURIComponent(job.taskId)}`, {
        headers: { 'x-alittlemovie-access-code': accessCode }, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '任务状态查询失败。');
      setJobs((current) => current.map((item) => item.taskId === job.taskId ? { ...item, status: data.status, videoUrl: data.videoUrl, error: data.error } : item));
    } catch (error) {
      setJobs((current) => current.map((item) => item.taskId === job.taskId ? { ...item, error: error instanceof Error ? error.message : '查询失败' } : item));
    }
  };

  useEffect(() => {
    if (!accessCode) return;
    const pending = jobs.filter((job) => !TERMINAL.has(job.status) && !job.videoUrl);
    if (!pending.length) return;
    const timer = window.setTimeout(() => { pending.forEach((job) => void refreshJob(job)); }, 8000);
    return () => window.clearTimeout(timer);
  }, [jobs, accessCode]);

  const generate = async (shot: Shot) => {
    if (!project) return;
    if (!accessCode.trim()) { setMessage('请先输入服务端配置的访问码。'); return; }
    if (!acknowledged) { setMessage('请先勾选确认会产生服务商费用。'); return; }
    const realDuration = snapDuration(shot.duration);
    const estimate = realDuration * unitPrice;
    if (estimate > remaining) { setMessage(`预算不足：本镜头估算 ¥${estimate.toFixed(2)}，当前剩余 ¥${remaining.toFixed(2)}。`); return; }
    setBusyShot(shot.id); setMessage(`正在提交视频生成任务（${realDuration}秒）……`);
    sessionStorage.setItem('alittlemovie-access-code', accessCode.trim());
    const prompt = makePrompt(shot);
    try {
      const response = await fetch('/api/video-generation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-alittlemovie-access-code': accessCode.trim() },
        body: JSON.stringify({ prompt, duration: realDuration, resolution }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '提交任务失败。');
      const job: VideoJob = { shotId: shot.id, taskId: data.taskId, status: 'processing', prompt, duration: realDuration, estimatedCost: estimate };
      setJobs((current) => [job, ...current]);
      const updated = { ...project, monthlySpent: Math.min(100, (project.monthlySpent ?? 0) + estimate) };
      setProject(updated);
      localStorage.setItem(PROJECT_KEY, JSON.stringify(updated));
      setAcknowledged(false);
      setMessage(`任务已提交（${realDuration}秒）。视频生成中约 1-2 分钟，会自动刷新；结果显示在下方"生成任务"区。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败，请检查配置并重试。');
    } finally { setBusyShot(''); }
  };

  // ====== Character image generation ======
  const generateCharImage = async (char: Character) => {
    if (!accessCode.trim()) { setMessage('请先输入访问码。'); return; }
    setGeneratingChar(char.id);
    try {
      const basePrompt = char.fullPrompt || `${char.name}：${char.description}`;
      // Build a clean guofeng (国漫) character sheet prompt
      const prompt = `${basePrompt}\n现代精致国漫角色设定图，电影级2.5D动画质感，精致写实动漫比例，细腻五官与发丝，真实服装面料，柔和均匀的影棚光，中性浅灰纯色背景，全身立绘，9:16竖构图。负面：多余手指，五官扭曲，比例失调，Q版，卡通，真人实拍，塑料皮肤，磨皮滤镜，网红脸，品牌标识，文字，水印，复杂背景。`;
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-alittlemovie-access-code': accessCode.trim() },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '图片生成失败');
      setCharImages((prev) => ({ ...prev, [char.id]: data.imageUrl }));
      setMessage(`${char.name} 的角色图已生成。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片生成失败');
    } finally { setGeneratingChar(''); }
  };

  if (!project) return <main className="generate-page"><a className="back-link" href="/">← 返回工作台</a><section className="panel generate-panel"><h1>先保存你的项目</h1><p>请回工作台完成剧本拆解、勾选重点动态镜头并点击"保存草稿"，然后再打开生成页。</p><a className="primary-btn generate-link" href="/">返回工作台</a></section></main>;

  return <main className="generate-page">
    <a className="back-link" href="/">← 返回剧本工作台</a>
    <header className="generate-header"><p className="eyebrow">MINIMAX HAILUO · 角色定妆 + 单镜头生成</p><h1>{project.name || '我的短剧'}</h1><p>先给每个角色生成国漫定妆图，再逐镜生成视频；视频提示词直接取自导演手册，保证与剧本一致。</p></header>

    <section className="panel generate-panel">
      <h2>连接设置</h2>
      <label className="form-label">本地访问码<input type="password" autoComplete="current-password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="与 .env.local 中的 ALITTLEMOVIE_ACCESS_CODE 一致" /></label>
      <label className="form-label">分辨率<select value={resolution} onChange={(event) => setResolution(event.target.value as '768P' | '1080P')}><option value="768P">768P（优先控制成本）</option><option value="1080P">1080P（费用可能更高）</option></select></label>
      <div className="cost-confirm"><input id="cost-ack" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><label htmlFor="cost-ack">我知道点击生成会调用真实 API 并产生费用；已核对当前模型价格和账户余额。</label></div>
      <div className="generation-budget"><span>可选镜头：{selectedShots.length}</span><span>剩余估算预算：¥{remaining.toFixed(2)}</span><span>所选镜头估算：¥{estimatedTotal.toFixed(2)}</span></div>
    </section>

    {message && <div className="notice" role="status"><span>✦</span><span className="notice-text">{message}</span><button onClick={() => setMessage('')} aria-label="关闭提示">×</button></div>}

    {/* ====== Character images ====== */}
    {characters.length > 0 && (
      <section className="generate-jobs">
        <h2>角色定妆图（先给角色生成国漫参考图）</h2>
        <div className="char-image-grid">
          {characters.map((char) => (
            <article className="panel char-image-card" key={char.id}>
              <div className="char-image-header">
                <span className="char-avatar">{char.name[0]}</span>
                <div><strong>{char.name}</strong><span className="char-look">{char.look || char.description}</span></div>
              </div>
              {charImages[char.id] ? (
                <img className="char-image-preview" src={charImages[char.id]} alt={`${char.name} 角色图`} />
              ) : (
                <div className="char-image-placeholder">尚未生成</div>
              )}
              <button className="secondary-btn" disabled={generatingChar === char.id} onClick={() => void generateCharImage(char)}>
                {generatingChar === char.id ? '生成中…' : charImages[char.id] ? '重新生成' : '生成角色图'}
              </button>
            </article>
          ))}
        </div>
      </section>
    )}

    {/* ====== Shots ====== */}
    <section className="generate-jobs"><h2>重点动态镜头</h2>
      {!selectedShots.length && <div className="panel empty-state"><h3>没有已勾选的镜头</h3><p>回工作台勾选"重点动态镜头"，保存草稿后再回来。</p></div>}
      {selectedShots.map((shot) => { const realDur = snapDuration(shot.duration); return <article className="panel generation-shot" key={shot.id}><div className="generation-shot-header"><div><span className="shot-number">{shot.title}</span><h3>{shot.sceneName}</h3></div><span>{realDur} 秒 · 估算 ¥{(realDur * unitPrice).toFixed(2)}</span></div><p>{shot.description}</p>{shot.duration !== realDur && <p className="field-note">原时长 {shot.duration}s → 已自动适配为 {realDur}s（MiniMax 仅支持 6/10 秒）。</p>}<details><summary>查看实际提交提示词（取自导演手册）</summary><pre>{makePrompt(shot)}</pre></details><button className="primary-btn" disabled={Boolean(busyShot) || !acknowledged} onClick={() => void generate(shot)}>{busyShot === shot.id ? '提交中…' : '生成这个镜头'}</button></article>; })}
    </section>

    {/* ====== Results ====== */}
    <section className="generate-jobs"><h2>生成任务（结果在这里查看）</h2>
      {!jobs.length && <div className="panel empty-state"><h3>还没有生成任务</h3><p>点击上方镜头里的"生成这个镜头"提交任务后，视频会在这里显示。</p></div>}
      {jobs.map((job) => <article className="panel generation-shot" key={job.taskId}><div className="generation-shot-header"><h3>镜头任务</h3><span className="job-status">{job.status}</span></div><p>任务编号：{job.taskId} · 时长 {job.duration} 秒 · 预算预留 ¥{job.estimatedCost.toFixed(2)}</p>{job.error && <p className="job-error">{job.error}</p>}{(job.status === 'processing' || job.status === 'queued') && <p className="field-note">⏳ 视频生成中，约 1-2 分钟，会自动刷新。也可以点下方"刷新状态"立即查询。</p>}{job.videoUrl && <><video className="generated-video" src={job.videoUrl} controls playsInline /><a className="text-btn download-link" href={job.videoUrl} target="_blank" rel="noreferrer">打开/下载生成视频 ↗</a></>}<button className="secondary-btn" onClick={() => void refreshJob(job)}>刷新任务状态</button></article>)}
    </section>
  </main>;
}
