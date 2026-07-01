type ApiActivitySubscriber = () => void;

export function getApiActivityCount() {
  return 0;
}

export function subscribeApiActivity(_subscriber: ApiActivitySubscriber) {
  return () => undefined;
}
