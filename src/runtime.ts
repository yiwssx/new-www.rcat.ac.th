import { createAppEmotionCache } from "./emotionCache";
import { createAppQueryClient } from "./queryClient";
import { createAppRouter } from "./routes";

export interface CreateAppRuntimeOptions {
  documentMode?: boolean;
  cspNonce?: string;
}

export function createAppRuntime({ documentMode = false, cspNonce }: CreateAppRuntimeOptions = {}) {
  const emotionCache = createAppEmotionCache();
  const queryClient = createAppQueryClient();
  const router = createAppRouter({ queryClient, documentMode, cspNonce });

  return {
    emotionCache,
    queryClient,
    router
  };
}

export type AppRuntime = ReturnType<typeof createAppRuntime>;
