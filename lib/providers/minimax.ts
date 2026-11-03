import type { GenerateParams, GenerateResult, StatusResult, VideoProvider } from './types';

const API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.io';

// 归一化 v1 状态为大写首字母 → 前端可识别的英文小写 key
const STATUS_MAP: Record<string, string> = {
  preparing: 'preparing',
  queueing: 'queueing',
  processing: 'processing',
  success: 'success',
  fail: 'failed',
};

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

    // MiniMax-Hailuo-2.3 的 10 秒镜头仅支持 768P
    if (params.duration === 10 && params.resolution === '1080P') {
      throw new Error('MiniMax-Hailuo-2.3 的 10 秒镜头仅支持 768P，请改用 768P 或把时长缩短为 6 秒。');
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

    // MiniMax v1 业务错误时仍返回 HTTP 200，需检查 base_resp.status_code
    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const msg =
        typeof data.base_resp?.status_msg === 'string'
          ? data.base_resp.status_msg
          : `MiniMax returned error code ${code}`;
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

    // v1 创建的任务必须用 v1 查询接口（task_id 走 query 参数，不是 path）
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

    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const msg =
        typeof data.base_resp?.status_msg === 'string'
          ? data.base_resp.status_msg
          : `Status query returned error code ${code}`;
      throw new Error(msg);
    }

    const status = STATUS_MAP[String(data.status ?? '').toLowerCase()] ?? 'unknown';
    let videoUrl: string | null = null;
    let error: string | null = null;

    // 成功后再用 file_id 换取限时下载地址（有效期 1 小时）
    if (status === 'success' && data.file_id != null) {
      const fileResp = await fetch(
        `${API_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(String(data.file_id))}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: 'no-store',
        }
      );
      const fileData = await fileResp.json().catch(() => ({}));
      videoUrl = typeof fileData.file?.download_url === 'string' ? fileData.file.download_url : null;
      if (fileResp.ok && !videoUrl) {
        error =
          typeof fileData.base_resp?.status_msg === 'string'
            ? fileData.base_resp.status_msg
            : '视频已生成，但未取到下载地址，请稍后重试。';
      }
    } else if (status === 'failed') {
      error =
        typeof data.base_resp?.status_msg === 'string'
          ? data.base_resp.status_msg
          : '生成失败，请查看服务商控制台。';
    }

    return { status, videoUrl, error };
  },
};
