export const chatLog = {
  send(requestId: string, userText: string) {
    console.log(`[chat:send] rid=${requestId.slice(0, 8)} msg="${userText.slice(0, 50)}"`);
  },
  receive(requestId: string, duration: number, hasPatches: boolean) {
    console.log(`[chat:receive] rid=${requestId.slice(0, 8)} duration=${duration}ms patches=${hasPatches}`);
  },
  error(requestId: string, error: string) {
    console.error(`[chat:error] rid=${requestId.slice(0, 8)} error="${error.slice(0, 100)}"`);
  },
  stream(requestId: string, event: string) {
    console.log(`[chat:stream] rid=${requestId.slice(0, 8)} event=${event}`);
  },
  apply(requestId: string, opCount: number) {
    console.log(`[chat:apply] rid=${requestId.slice(0, 8)} ops=${opCount}`);
  },
};
