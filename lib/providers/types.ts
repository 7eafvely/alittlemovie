export interface GenerateParams {
  prompt: string;
  duration: number;
  resolution: string;
  firstFrameImage?: string;
}

export interface GenerateResult {
  taskId: string;
  model: string;
  duration: number;
  resolution: string;
}

export interface StatusResult {
  status: string;
  videoUrl: string | null;
  error?: string | null;
}

export interface VideoProvider {
  readonly name: string;
  readonly displayName: string;
  readonly supportedDurations: number[];
  readonly maxPromptLength: number;
  readonly supportedResolutions: string[];

  submit(params: GenerateParams): Promise<GenerateResult>;
  queryStatus(taskId: string): Promise<StatusResult>;
}
