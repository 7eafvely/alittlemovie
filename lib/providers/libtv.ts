import type { GenerateParams, GenerateResult, StatusResult, VideoProvider } from './types';
import {
  libtvCreateSession,
  libtvQuerySession,
  extractVideoUrls,
  detectLibTvError,
} from '../libtv-client';

const DEFAULT_VIDEO_MODEL = process.env.LIBTV_VIDEO_MODEL || 'seedance-2.0-vip';

// LibTV 是会话式接口：submit 建会话并发一条「角色模型图生视频」指令，
// taskId 即会话 sessionId；queryStatus 轮询会话消息取回视频 URL。
export const libtvProvider: VideoProvider = {
  name: 'libtv',
  displayName: 'LibTV 角色模型',
  supportedDurations: [5, 6, 10],
  maxPromptLength: 4000,
  supportedResolutions: ['720P', '1080P'],

  async submit(params: GenerateParams): Promise<GenerateResult> {
    const instruction = [
      '[模型/参数指令]',
      `指定模型：${DEFAULT_VIDEO_MODEL}`,
      '比例：9:16',
      `时长：${params.duration}秒`,
      `分辨率：${params.resolution}`,
    ].join('\n');
    const refLine = params.firstFrameImage ? `首帧参考图：${params.firstFrameImage}\n` : '';
    const message = [
      instruction,
      '',
      '[生成需求]',
      '请以参考图作为视频首帧，用角色模型生成一段短视频（对应「首帧图生视频」流程）。',
      refLine + `镜头描述：${params.prompt}`,
      '要求：严格保持参考图中人物的脸型、发型、服装一致，动作自然连贯，电影感写实，竖屏 9:16，无文字、无水印、无logo。',
    ].join('\n');

    const session = await libtvCreateSession(message);
    return {
      taskId: session.sessionId,
      model: DEFAULT_VIDEO_MODEL,
      duration: params.duration,
      resolution: params.resolution,
    };
  },

  async queryStatus(taskId: string): Promise<StatusResult> {
    const messages = await libtvQuerySession(taskId);
    const videoUrl = extractVideoUrls(messages)[0] ?? null;
    const error = videoUrl ? null : detectLibTvError(messages);
    const status = videoUrl ? 'success' : error ? 'failed' : 'processing';
    return { status, videoUrl, error };
  },
};
