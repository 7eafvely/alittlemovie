import type { GenerateParams, GenerateResult, StatusResult, VideoProvider } from './types';

let counter = 0;

export const mockProvider: VideoProvider = {
  name: 'mock',
  displayName: 'Mock (Testing Only)',
  supportedDurations: [5, 6, 10, 15],
  maxPromptLength: 4000,
  supportedResolutions: ['768P', '1080P'],

  async submit(params: GenerateParams): Promise<GenerateResult> {
    counter += 1;
    return {
      taskId: `mock-task-${counter}-${Date.now()}`,
      model: 'mock-v1',
      duration: params.duration,
      resolution: params.resolution,
    };
  },

  async queryStatus(_taskId: string): Promise<StatusResult> {
    const phases = ['queued', 'processing', 'processing', 'succeeded'];
    const phase = phases[Math.floor(Math.random() * phases.length)];
    return {
      status: phase,
      videoUrl:
        phase === 'succeeded'
          ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
          : null,
    };
  },
};
