import { createAppQueryClient } from "./queryClient";
import { createAppRouter } from "./routes";

export function createAppRuntime() {
  const queryClient = createAppQueryClient();
  const router = createAppRouter({ queryClient });

  return {
    queryClient,
    router
  };
}

export type AppRuntime = ReturnType<typeof createAppRuntime>;
