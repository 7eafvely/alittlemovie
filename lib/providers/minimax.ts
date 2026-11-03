import type { GenerateParams, GenerateResult, StatusResult, VideoProvider } from './types';

const API_BASE = 'https://api.minimax.io';

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

    if (typeof data.task_id !== 'string' || !data.task_id) {
      throw new Error('MiniMax did not return a task ID');
    }

    return {
      taskId: data.task_id,
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
      `${API_BASE}/v2/query/video_generation/${encodeURIComponent(taskId)}`,
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

    return {
      status: typeof data.status === 'string' ? data.status : 'unknown',
      videoUrl:
        typeof data.video_url === 'string' && data.video_url
          ? data.video_url
          : null,
    };
  },
};
