declare module 'y-websocket/bin/utils' {
  import type { WebSocket } from 'ws';
  import type { IncomingMessage } from 'http';
  import type * as Y from 'yjs';

  export function setupWSConnection(
    ws: WebSocket,
    req: IncomingMessage,
    options?: { docName?: string; gc?: boolean },
  ): void;

  export const docs: Map<string, Y.Doc>;
}
