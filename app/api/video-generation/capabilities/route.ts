import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers/registry';

export const runtime = 'nodejs';

// 暴露当前生效视频服务商的公开能力（名称、支持的时长与分辨率），供前端自适应渲染。
// 不含任何密钥，无需访问码。
export async function GET() {
  try {
    const provider = getProvider();
    return NextResponse.json({
      name: provider.name,
      displayName: provider.displayName,
      supportedDurations: provider.supportedDurations,
      supportedResolutions: provider.supportedResolutions,
      maxPromptLength: provider.maxPromptLength,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法读取服务商配置。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
