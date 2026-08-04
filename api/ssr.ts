import { handleVercelPublicSsrRequest } from "../src/vercelSsr";

export default {
  fetch(request: Request) {
    return handleVercelPublicSsrRequest(request);
  }
};
