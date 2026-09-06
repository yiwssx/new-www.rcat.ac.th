import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CMS_AUTH_CHANNEL_NAME } from "./constants";

type MessageListener = (event: MessageEvent<unknown>) => void;

class BrowserLikeBroadcastChannel {
  static channels = new Map<string, Set<BrowserLikeBroadcastChannel>>();

  private readonly listeners = new Set<MessageListener>();

  constructor(readonly name: string) {
    const peers = BrowserLikeBroadcastChannel.channels.get(name) ?? new Set<BrowserLikeBroadcastChannel>();
    peers.add(this);
    BrowserLikeBroadcastChannel.channels.set(name, peers);
  }

  addEventListener(type: string, listener: MessageListener) {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: MessageListener) {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  postMessage(message: unknown) {
    for (const channel of BrowserLikeBroadcastChannel.channels.get(this.name) ?? []) {
      if (channel === this) {
        continue;
      }

      for (const listener of channel.listeners) {
        listener({ data: message } as MessageEvent<unknown>);
      }
    }
  }

  close() {
    BrowserLikeBroadcastChannel.channels.get(this.name)?.delete(this);
    this.listeners.clear();
  }

  static reset() {
    BrowserLikeBroadcastChannel.channels.clear();
  }
}

describe("CMS session events", () => {
  beforeEach(() => {
    vi.resetModules();
    BrowserLikeBroadcastChannel.reset();
    vi.stubGlobal("BroadcastChannel", BrowserLikeBroadcastChannel);
  });

  afterEach(() => {
    BrowserLikeBroadcastChannel.reset();
    vi.unstubAllGlobals();
  });

  it("does not re-deliver a local broadcast to the same page subscriber", async () => {
    const { broadcastCmsSessionEvent, subscribeToCmsSessionEvents } = await import("./sessionEvents");
    const listener = vi.fn();
    const unsubscribe = subscribeToCmsSessionEvents(listener);

    broadcastCmsSessionEvent("session-changed");

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("still delivers a session event from another browsing context", async () => {
    const { subscribeToCmsSessionEvents } = await import("./sessionEvents");
    const listener = vi.fn();
    const unsubscribe = subscribeToCmsSessionEvents(listener);
    const otherTab = new BroadcastChannel(CMS_AUTH_CHANNEL_NAME);

    otherTab.postMessage("session-changed");

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("session-changed");
    otherTab.close();
    unsubscribe();
  });
});
