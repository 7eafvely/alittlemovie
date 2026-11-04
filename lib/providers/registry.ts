import type { VideoProvider } from './types';
import { minimaxProvider } from './minimax';
import { libtvProvider } from './libtv';
import { mockProvider } from './mock';

const providers: Record<string, VideoProvider> = {
  minimax: minimaxProvider,
  libtv: libtvProvider,
  mock: mockProvider,
};

export function getProvider(name?: string): VideoProvider {
  const key = name || process.env.VIDEO_PROVIDER || 'minimax';
  const provider = providers[key];
  if (!provider) {
    throw new Error(
      `Unknown video provider: ${key}. Available: ${Object.keys(providers).join(', ')}`
    );
  }
  return provider;
}

export function listProviders(): Array<{ name: string; displayName: string }> {
  return Object.values(providers).map((p) => ({
    name: p.name,
    displayName: p.displayName,
  }));
}
