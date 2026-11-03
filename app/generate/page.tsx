'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Shot = { id: string; title: string; description: string; duration: number; makeVideo?: boolean };
type Scene = { id: string; name: string; shots: Shot[] };
type Project = { name: string; script: string; scenes: Scene[]; characterNotes?: string; visualStyle?: string; monthlySpent?: number; videoPricePerSecond?: number };
type VideoJob = { shotId: string; taskId: string; status: string; videoUrl?: string | null; error?: string | null; prompt: string; duration: number; estimatedCost: number };
const PROJECT_KEY = 'alittlemovie-project-v2';
const JOBS_KEY = 'alittlemovie-video-jobs-v1';
const TERMINAL = new Set(['succeeded', 'success', 'failed', 'fail', 'cancelled', 'canceled']);

export default function GeneratePage() {
  const [project, setProject] = useState<Project | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [referenceImage, setReferenceImage] = useState('');
  const [resolution, setResolution] = useState<'768P' | '1080P'>('768P');
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [busyShot, setBusyShot] = useState('');
  const [message, setMessage] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

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

  const makePrompt = (shot: Shot) => `${shot.description}\n${project?.characterNotes ? `角色外观：${project.characterNotes}\n` : ''}${project?.visualStyle ?? ''}\n竖屏 9:16，保持参考图中人物的脸、发型、服装和整体画风一致。动作自然连贯，避免人物外观变化。`;

  const refreshJob = useCallback(async (job: VideoJob) => {
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
  }, [accessCode]);

  useEffect(() => {
    if (!accessCode) return;
    const pending = jobs.filter((job) => !TERMINAL.has(job.status) && !job.videoUrl);
    if (!pending.length) return;
    const timer = window.setTimeout(() => { pending.forEach((job) => void refreshJob(job)); }, 8000);
    return () => window.clearTimeout(timer);
  }, [jobs, accessCode, refreshJob]);

  const generate = async (shot: Shot) => {
    if (!project) return;
    if (!accessCode.trim()) { setMessage('请先输入服务端配置的访问码。'); return; }
    if (!acknowledged) { setMessage('请先确认本次生成会产生服务商费用。'); return; }
    const estimate = shot.duration * unitPrice;
    if (estimate > remaining) { setMessage(`预算不足：本镜头估算 ¥${estimate.toFixed(2)}，当前剩余 ¥${remaining.toFixed(2)}。`); return; }
    setBusyShot(shot.id); setMessage('正在提交视频生成任务……');
    sessionStorage.setItem('alittlemovie-access-code', accessCode.trim());
    const prompt = makePrompt(shot);
    try {
      const response = await fetch('/api/video-generation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-alittlemovie-access-code': accessCode.trim() },
        body: JSON.stringify({ prompt, duration: shot.duration, resolution, firstFrameImage: referenceImage.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '提交任务失败。');
      const job: VideoJob = { shotId: shot.id, taskId: data.taskId, status: 'processing', prompt, duration: shot.duration, estimatedCost: estimate };
      setJobs((current) => [job, ...current]);
      const updated = { ...project, monthlySpent: Math.min(100, (project.monthlySpent ?? 0) + estimate) };
      setProject(updated);
      localStorage.setItem(PROJECT_KEY, JSON.stringify(updated));
      setAcknowledged(false);
      setMessage(`任务已提交。已按估算值预留 ¥${estimate.toFixed(2)}；请在服务商账单核对实际花费。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败，请检查配置并重试。');
    } finally { setBusyShot(''); }
  };

  if (!project) return <main className="generate-page"><a className="back-link" href="/">← 返回工作台</a><section className="panel generate-panel"><h1>先保存你的项目</h1><p>请回工作台完成剧本拆解、勾选重点动态镜头并点击“保存草稿”，然后再打开生成页。</p><a className="primary-btn generate-link" href="/">返回工作台</a></section></main>;

  return <main className="generate-page">
    <a className="back-link" href="/">← 返回剧本工作台</a>
    <header className="generate-header"><p className="eyebrow">MINIMAX HAILUO · 单镜头生成</p><h1>{project.name || '我的短剧'}：生成视频镜头</h1><p>只提交勾选的关键镜头；角色参考图可帮助保持人物和画风一致，但效果不保证完全相同。</p></header>
    <section className="panel generate-panel">
      <h2>连接你自己的 MiniMax API</h2>
      <p>API Key 必须留在服务端环境变量，不能填进网页或代码仓库。访问码由你在本机配置，用于避免他人随意调用你的额度。</p>
      <label className="form-label">本地访问码<input type="password" autoComplete="current-password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="与 .env.local 中的 ALITTLEMOVIE_ACCESS_CODE 一致" /></label>
      <label className="form-label">角色/场景参考图 HTTPS 链接（可选）<input type="url" value={referenceImage} onChange={(event) => setReferenceImage(event.target.value)} placeholder="https://... 可公开访问的图片地址" /></label>
      <p className="field-note">只支持可被服务商访问的 HTTPS 图片 URL；本页面暂不上传本地图片。没有参考图时将使用纯文字生成，人物一致性会更弱。</p>
      <label className="form-label">分辨率<select value={resolution} onChange={(event) => setResolution(event.target.value as '768P' | '1080P')}><option value="768P">768P（优先控制成本）</option><option value="1080P">1080P（费用可能更高）</option></select></label>
      <div className="cost-confirm"><input id="cost-ack" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><label htmlFor="cost-ack">我知道点击生成会调用真实 API 并产生费用；已核对当前模型价格和账户余额。</label></div>
      <div className="generation-budget"><span>可选关键镜头：{selectedShots.length}</span><span>剩余估算预算：¥{remaining.toFixed(2)}</span><span>所选镜头估算：¥{estimatedTotal.toFixed(2)}</span></div>
      <p className="field-note">网页仅按你在工作台填写的估算单价预留预算，不能读取或限制 MiniMax 账户账单。请先核对官方实时价格；任务失败也可能产生费用。生成结果链接可能会过期，请完成后立即下载。</p>
    </section>

    {message && <div className="notice" role="status"><span>✦</span><span className="notice-text">{message}</span><button onClick={() => setMessage('')} aria-label="关闭提示">×</button></div>}
    <section className="generate-jobs"><h2>重点动态镜头</h2>
      {!selectedShots.length && <div className="panel empty-state"><h3>没有已勾选的镜头</h3><p>回工作台勾选“重点动态镜头”，保存草稿后再回来。</p></div>}
      {selectedShots.map((shot) => { const durationValid = shot.duration === 6 || shot.duration === 10; const resolutionValid = !(shot.duration === 10 && resolution === '1080P'); const issue = !durationValid ? '当前服务仅接受 6 秒或 10 秒镜头，请回工作台调整时长。' : !resolutionValid ? '10 秒镜头仅支持 768P 分辨率，请切换分辨率或缩短时长。' : ''; return <article className="panel generation-shot" key={shot.id}><div className="generation-shot-header"><div><span className="shot-number">{shot.title}</span><h3>{shot.sceneName}</h3></div><span>{shot.duration} 秒 · 估算 ¥{(shot.duration * unitPrice).toFixed(2)}</span></div><p>{shot.description}</p><details><summary>查看实际提交提示词</summary><pre>{makePrompt(shot)}</pre></details><button className="primary-btn" disabled={Boolean(busyShot) || !acknowledged || !durationValid || !resolutionValid} onClick={() => void generate(shot)}>{busyShot === shot.id ? '提交中…' : '生成这个镜头'}</button>{issue && <span className="field-note">{issue}</span>}</article>; })}
    </section>

    {!!jobs.length && <section className="generate-jobs"><h2>生成任务</h2>{jobs.map((job) => <article className="panel generation-shot" key={job.taskId}><div className="generation-shot-header"><h3>镜头任务</h3><span className="job-status">{job.status}</span></div><p>任务编号：{job.taskId} · 时长 {job.duration} 秒 · 预算预留 ¥{job.estimatedCost.toFixed(2)}</p>{job.error && <p className="job-error">{job.error}</p>}{job.videoUrl && <><video className="generated-video" src={job.videoUrl} controls playsInline /><a className="text-btn download-link" href={job.videoUrl} target="_blank" rel="noreferrer">打开/下载生成视频 ↗</a></>}<button className="secondary-btn" onClick={() => void refreshJob(job)}>刷新任务状态</button></article>)}</section>}
  </main>;
}
