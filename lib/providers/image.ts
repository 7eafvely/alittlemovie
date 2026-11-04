import { libtvCreateSession, pollForImages } from '../libtv-client';

export interface ImageGenerateParams {
  prompt: string;
}

export interface ImageGenerateResult {
  imageUrls: string[];
  id?: string | null;
}

export interface ImageProvider {
  readonly name: string;
  readonly displayName: string;
  generate(params: ImageGenerateParams): Promise<ImageGenerateResult>;
}

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.io';
const MAX_PROMPT_LENGTH = 1500;

export const minimaxImageProvider: ImageProvider = {
  name: 'minimax',
  displayName: 'MiniMax 文生图',

  async generate({ prompt }: ImageGenerateParams): Promise<ImageGenerateResult> {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('服务端尚未配置 MINIMAX_API_KEY。');

    const upstream = await fetch(`${MINIMAX_API_BASE}/v1/image_generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: '9:16',
        response_format: 'url',
        n: 1,
        prompt_optimizer: true,
      }),
      cache: 'no-store',
    });

    const data = (await upstream.json().catch(() => ({}))) as {
      base_resp?: { status_code?: number; status_msg?: string };
      data?: { image_urls?: string[] };
      id?: string | null;
    };
    if (!upstream.ok) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : '定妆图生成失败，请检查账号额度和模型权限。';
      throw new Error(message);
    }

    const code = typeof data.base_resp?.status_code === 'number' ? data.base_resp.status_code : 0;
    if (code !== 0) {
      const message = typeof data.base_resp?.status_msg === 'string' ? data.base_resp.status_msg : `定妆图生成返回错误码 ${code}。`;
      throw new Error(message);
    }

    const imageUrls = Array.isArray(data.data?.image_urls) ? data.data.image_urls : [];
    if (!imageUrls.length) throw new Error('服务商未返回图片地址，请重试。');
    return { imageUrls, id: data.id ?? null };
  },
};

const DEFAULT_IMAGE_MODEL = process.env.LIBTV_IMAGE_MODEL || 'seedream-5.0';

// LibTV 角色模型：用「角色三视图」流程生成定妆图，返回正面/多角度图片地址。
export const libtvImageProvider: ImageProvider = {
  name: 'libtv',
  displayName: 'LibTV 角色模型',

  async generate({ prompt }: ImageGenerateParams): Promise<ImageGenerateResult> {
    const message = [
      '[模型/参数指令]',
      `指定模型：${DEFAULT_IMAGE_MODEL}`,
      '比例：9:16',
      '',
      '[生成需求]',
      '请生成角色定妆图（角色三视图），保持角色一致性。',
      `角色描述：${prompt}`,
      '要求：正面半身，面部清晰，中性浅灰纯色背景，电影感真人写实，超高清，无文字、无水印。',
    ].join('\n');

    const session = await libtvCreateSession(message);
    const imageUrls = await pollForImages(session.sessionId);
    if (!imageUrls.length) throw new Error('LibTV 未在超时时间内返回图片地址，请稍后在画布查看结果。');
    return { imageUrls, id: session.sessionId };
  },
};

const providers: Record<string, ImageProvider> = {
  minimax: minimaxImageProvider,
  libtv: libtvImageProvider,
};

export function getImageProvider(name?: string): ImageProvider {
  const key = name || process.env.IMAGE_PROVIDER || 'minimax';
  const provider = providers[key];
  if (!provider) {
    throw new Error(`Unknown image provider: ${key}. Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

export { MAX_PROMPT_LENGTH };
