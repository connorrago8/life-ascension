declare module 'web-push' {
  type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
  type SendOptions = { TTL?: number; headers?: Record<string, string> };
  type SendResult = { statusCode: number };
  function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  function sendNotification(subscription: PushSubscription, payload: string | Buffer, options?: SendOptions): Promise<SendResult>;
  export { setVapidDetails, sendNotification };
  const webpush: { setVapidDetails: typeof setVapidDetails; sendNotification: typeof sendNotification };
  export default webpush;
}
