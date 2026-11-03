'use client';

import { useEffect, useMemo, useState } from 'react';

type TimelineClip = {
  shotId: string;
  videoUrl?: string;
  shotTitle: string;
  sceneName?: string;
  description: string;
  duration: number;
  subtitle?: string;
};

type Project = { name: string; script: string; scenes: any[]; characterNotes?: string; visualStyle?: string; monthlySpent?: number; videoPricePerSecond?: number };
type VideoJob = { shotId: string; taskId: string; status: string; videoUrl?: string | null; error?: string | null; prompt: string; duration: number; estimatedCost: number };

const PKEY = 'alittlemovie-project-v2';
const JKEY = 'alittlemovie-video-jobs-v1';

export default function EditPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [title, setTitle] = useState('');
  const [subtitles, setSubtitles] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [currentIdx, setCurrentIdx] = useState(-1);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PKEY);
      if (raw) {
        const p = JSON.parse(raw);
        setProject(p);
        setTitle(p.name || 'My Short Drama');
      }
      const saved = localStorage.getItem(JKEY);
      if (saved) setJobs(JSON.parse(saved));
    } catch { setMsg('Failed to load project data.'); }
  }, []);

  const allShots: Array<any> = useMemo(() => {
    const shots: Array<any> = [];
    (project?.scenes ?? []).forEach((scene: any) => {
      scene.shots.forEach((shot: any) => {
        shots.push({ ...shot, sceneName: scene.name });
      });
    });
    return shots;
  }, [project]);

  const doneJobs = useMemo(
    () => jobs.filter((j: VideoJob) => (j.status === 'succeeded' || j.status === 'success') && j.videoUrl),
    [jobs]
  );

  const clips = useMemo(() => {
    return allShots
      .map((shot: any) => {
        const job = doneJobs.find((j: VideoJob) => j.shotId === shot.id);
        if (!job?.videoUrl) return null;
        return {
          shotId: shot.id,
          videoUrl: job.videoUrl,
          shotTitle: shot.title,
          sceneName: shot.sceneName,
          description: shot.description,
          duration: shot.duration,
          subtitle: subtitles[shot.id] || shot.description,
        } as TimelineClip;
      })
      .filter((clip: TimelineClip | null): clip is TimelineClip => clip !== null);
  }, [allShots, doneJobs, subtitles]);

  const totalDur = clips.reduce((a: number, c) => a + (c.duration || 0), 0);

  const downloadVideo = (url: string, sid: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shot-' + sid + '.mp4';
    a.target = '_blank';
    a.click();
  };

  const exportConfig = () => {
    const cfg = {
      projectName: title,
      totalDuration: totalDur + 's',
      clips: clips.map((c) => ({
        shotTitle: c.shotTitle,
        sceneName: c.sceneName,
        videoUrl: c.videoUrl,
        subtitle: c.subtitle,
        duration: c.duration,
      })),
      exportedAt: new Date().toISOString(),
      guide: 'Use FFmpeg: ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4',
    };
    const blob = new Blob([JSON.stringify(cfg, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (title || 'drama') + '-config.json';
    a.click();
    setMsg('Export config downloaded.');
  };

  const exportFfmpeg = () => {
    let script = '#!/bin/bash\n\n';
    script += '# Alittlemovie FFmpeg Export Script\n';
    script += '# Project: ' + title + '\n\n';
    script += '# Prerequisites: Install FFmpeg - https://ffmpeg.org\n';
    script += '# 1. Download all video files into this directory\n';
    script += '# 2. Run: bash ffmpeg_export.sh\n\n';

    clips.forEach((c, i) => {
      script += '# Clip ' + (i + 1) + ': ' + c.shotTitle + ' - ' + (c.sceneName || '') + '\n';
      script += "file 'shot_" + c.shotId + ".mp4'\n";
      if (c.subtitle) {
        script += '# Subtitle: ' + c.subtitle + '\n';
      }
      script += '\n';
    });

    const safeName = title.replace(/\s+/g, '_') || 'drama';
    script += 'ffmpeg -f concat -safe 0 -i concat.txt -c copy -y ' + safeName + '_merged.mp4\n';
    script += 'echo "Done! Output: ' + safeName + '_merged.mp4"\n';

    const blob = new Blob([script], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ffmpeg_export.sh';
    a.click();
    setMsg('FFmpeg script downloaded.');
  };

  if (!clips.length) {
    return (
      <main className="generate-page">
        <a className="back-link" href="/">{'<<'} Back to Script Editor</a>
        <section className="panel generate-panel" style={{ marginTop: 30 }}>
          <h1>No Generated Videos Yet</h1>
          <p>Generate video clips first, then preview and export here.</p>
          <a className="primary-btn generate-link" href="/generate">
            Go to Video Generation
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="generate-page">
      <a className="back-link" href="/">{'<<'} Back to Script Editor</a>

      <header className="generate-header">
        <p className="eyebrow">Final Cut Preview & Export</p>
        <h1>{title}</h1>
        <p>
          {clips.length} clips | Total ~{totalDur}s
        </p>
      </header>

      {msg && (
        <div className="notice" role="status">
          <span>+</span>
          <span className="notice-text">{msg}</span>
          <button onClick={() => setMsg('')} aria-label="Close">x</button>
        </div>
      )}

      <section className="panel generate-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Timeline</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="secondary-btn" onClick={exportConfig}>
              Export JSON Config
            </button>
            <button className="secondary-btn" onClick={exportFfmpeg}>
              Export FFmpeg Script
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 6,
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #f59e0b)',
            borderRadius: 3,
            width: totalDur > 0 ? '100%' : '0%',
            margin: '8px 0',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888b94' }}>
          <span>0s</span>
          <span>{totalDur}s</span>
        </div>

        {/* Clip cards */}
        <div style={{ marginTop: 20 }}>
          {clips.map((clip, idx) => (
            <article
              key={clip.shotId}
              className="generation-shot"
              onClick={() => setCurrentIdx(idx)}
              style={{
                cursor: 'pointer',
                borderColor: currentIdx === idx ? '#8b5cf6' : '#353841',
                borderWidth: currentIdx === idx ? 2 : 1,
              }}
            >
              <div className="generation-shot-header">
                <div>
                  <span style={{ color: '#8b5cf6', fontWeight: 700, marginRight: 10 }}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <strong>{clip.shotTitle}</strong>
                </div>
                <span style={{ fontSize: 12, color: '#888b94' }}>
                  {clip.sceneName} | {clip.duration}s
                </span>
              </div>

              <p>{clip.description}</p>

              {clip.videoUrl && (
                <div style={{ marginTop: 12 }}>
                  <video
                    className="generated-video"
                    src={clip.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    style={{ width: 'min(100%, 360px)', maxHeight: 640 }}
                  />
                  <button
                    className="text-btn download-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadVideo(clip.videoUrl!, clip.shotId);
                    }}
                  >
                    Download this clip
                  </button>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label className="form-label">
                  Subtitle Text
                  <input
                    type="text"
                    value={subtitles[clip.shotId] || ''}
                    onChange={(e) => {
                      setSubtitles((prev) => ({
                        ...prev,
                        [clip.shotId]: e.target.value,
                      }));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter subtitle text..."
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel generate-panel">
        <h2>Export Guide</h2>
        <div
          className="generation-budget"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          <div>
            <b>Video Clips</b>
            <p>{clips.length} clips</p>
          </div>
          <div>
            <b>Total Duration</b>
            <p>~{totalDur}s</p>
          </div>
          <div>
            <b>Merge Method</b>
            <p>Download clips + FFmpeg merge, or use editing software</p>
          </div>
          <div>
            <b>Subtitles</b>
            <p>Edit subtitles above, export as SRT, burn with FFmpeg</p>
          </div>
        </div>
        <p className="field-note" style={{ marginTop: 12 }}>
          Current version uses local FFmpeg for merging. Download all clips and the FFmpeg script, run locally to get the final video. Future versions will support server-side FFmpeg synthesis.
        </p>
      </section>

      <footer className="footer-note">
        Alittlemovie Studio &middot; Final Cut Preview &middot; Videos generated by AI, please review content compliance
      </footer>
    </main>
  );
}
