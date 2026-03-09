import type { FetchOptions, YTLiveChatOptions } from "../types/index.js";

export interface FetchLivePageRequest {
  handle?: string;
  channelId?: string;
  liveId?: string;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class YTHttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: YTLiveChatOptions) {
    this.baseUrl = options.youtubeBaseUrl ?? "https://www.youtube.com";
    this.fetchImpl = options.fetchImplementation ?? fetch;
  }

  async fetchLivePage(request: FetchLivePageRequest, signal?: AbortSignal): Promise<string> {
    const targetUrl = this.buildLivePageUrl(request);
    const response = await this.fetchImpl(targetUrl, {
      method: "GET",
      signal,
      headers: {
        "user-agent": "ytlc/0.1",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load live page (${response.status}).`);
    }

    return response.text();
  }

  async fetchLiveChatData(fetchOptions: FetchOptions, signal?: AbortSignal): Promise<unknown> {
    const url = `${this.baseUrl}/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(fetchOptions.apiKey)}`;

    const body = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: fetchOptions.clientVersion,
        },
      },
      continuation: fetchOptions.continuation,
      currentPlayerState: {
        playerOffsetMs: "0",
      },
    };

    const maxRetryAttempts = 5;
    const baseDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetryAttempts; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "ytlc/0.1",
        },
        body: JSON.stringify(body),
      });

      if (response.status === 403) {
        throw new Error("Received HTTP 403 while polling live chat.");
      }

      if (response.ok) {
        return response.json();
      }

      if (attempt >= maxRetryAttempts || response.status < 500) {
        throw new Error(`Failed to fetch live chat data (${response.status}).`);
      }

      const expBackoff = Math.min(baseDelayMs * 2 ** (attempt - 1), 30_000);
      const jitter = expBackoff * 0.2 * (Math.random() - 0.5) * 2;
      await delay(Math.max(200, Math.floor(expBackoff + jitter)));
    }

    throw new Error("Failed to fetch live chat data after retries.");
  }

  private buildLivePageUrl(request: FetchLivePageRequest): string {
    if (request.liveId) {
      return `${this.baseUrl}/watch?v=${encodeURIComponent(request.liveId)}`;
    }

    if (request.handle) {
      return `${this.baseUrl}/${request.handle.replace(/^@?/, "@")}/live`;
    }

    if (request.channelId) {
      return `${this.baseUrl}/channel/${encodeURIComponent(request.channelId)}/live`;
    }

    throw new Error("Either handle, channelId, or liveId must be provided.");
  }
}
