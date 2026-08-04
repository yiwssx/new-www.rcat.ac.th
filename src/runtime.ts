import { createAppEmotionCache } from "./emotionCache";
import { createAppQueryClient } from "./queryClient";
import { createAppRouter } from "./routes";

export function createAppRuntime() {
  const emotionCache = createAppEmotionCache();
  const queryClient = createAppQueryClient();
  const router = createAppRouter({ queryClient });

  return {
    emotionCache,
    queryClient,
    router
  };
}

export type AppRuntime = ReturnType<typeof createAppRuntime>;
