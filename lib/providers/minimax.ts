import type { GenerateParams, GenerateResult, StatusResult, VideoProvider } from './types';

const API_BASE = 'https://api.minimaxi.com';

export const minimaxProvider: VideoProvider = {
  name: 'minimax',
  displayName: 'MiniMax Hailuo',
  supportedDurations: [6, 10],
  maxPromptLength: 2000,
  supportedResolutions: ['768P', '1080P'],

  async submit(params: GenerateParams): Promise<GenerateResult> {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY not configured');
    }

    const payload: Record<string, unknown> = {
      model: 'MiniMax-Hailuo-2.3',
      prompt: params.prompt,
      duration: params.duration,
      resolution: params.resolution,
    };
    if (params.firstFrameImage) {
      payload.first_frame_image = params.firstFrameImage;
    }

    const response = await fetch(`${API_BASE}/v1/video_generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        typeof data.base_resp?.status_msg === 'string'
          ? data.base_resp.status_msg
          : 'MiniMax submission failed';
      throw new Error(msg);
    }

    const taskId = String(data.task_id ?? '');
    if (!taskId) {
      throw new Error('MiniMax did not return a task ID');
    }

    return {
      taskId,
      model: 'MiniMax-Hailuo-2.3',
      duration: params.duration,
      resolution: params.resolution,
    };
  },

  async queryStatus(taskId: string): Promise<StatusResult> {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY not configured');
    }

    const response = await fetch(
      `${API_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        typeof data.base_resp?.status_msg === 'string'
          ? data.base_resp.status_msg
          : 'Status query failed';
      throw new Error(msg);
    }

    // MiniMax returns status like "Queueing", "Processing", "Success", "Fail"
    // Normalize to standard lowercase statuses
    const rawStatus = data.status || 'unknown';
    let status = 'processing';
    if (rawStatus === 'Queueing' || rawStatus === 'Preparing') status = 'queued';
    else if (rawStatus === 'Processing') status = 'processing';
    else if (rawStatus === 'Success') status = 'succeeded';
    else if (rawStatus === 'Fail') status = 'failed';
    else status = rawStatus.toLowerCase();

    // When done, MiniMax returns file_id not video_url
    // Need to call download API to get the actual video URL
    let videoUrl: string | null = null;
    if (typeof data.video_url === 'string' && data.video_url) {
      videoUrl = data.video_url;
    } else if (status === 'succeeded' && data.file_id) {
      // Fetch download URL from file_id
      const fileId = data.file_id;
      if (fileId) {
        const dlResp = await fetch(
          `${API_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            cache: 'no-store',
          }
        );
        const dlData = await dlResp.json().catch(() => ({}));
        if (dlData.file?.download_url) {
          videoUrl = dlData.file.download_url;
        }
      }
    }

    return { status, videoUrl };
  },
};
