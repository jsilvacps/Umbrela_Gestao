declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface RequestOptions {
    gcmAPIKey?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    headers?: Record<string, string>;
    contentEncoding?: "aesgcm" | "aes128gcm";
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    proxy?: string;
    agent?: unknown;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions,
  ): Promise<{ statusCode: number; body: string; headers: Record<string, string> }>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
