import { createAppEmotionCache } from "./emotionCache";
import { createAppQueryClient } from "./queryClient";
import { createAppRouter } from "./routes";

export interface CreateAppRuntimeOptions {
  documentMode?: boolean;
}

export function createAppRuntime({ documentMode = false }: CreateAppRuntimeOptions = {}) {
  const emotionCache = createAppEmotionCache();
  const queryClient = createAppQueryClient();
  const router = createAppRouter({ queryClient, documentMode });

  return {
    emotionCache,
    queryClient,
    router
  };
}

export type AppRuntime = ReturnType<typeof createAppRuntime>;
