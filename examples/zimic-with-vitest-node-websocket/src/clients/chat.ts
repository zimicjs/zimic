import { WebSocketClient, WebSocketSchema } from '@zimic/ws';

export const CHAT_BASE_URL = 'ws://localhost:3000';

export type ChatMessage = { type: 'message'; data: { text: string } } | { type: 'presence'; data: { online: boolean } };

export type ChatSchema = WebSocketSchema<{
  '/rooms/:roomId': {
    message: ChatMessage;
  };
}>;

export async function joinChatRoom(roomId: string, onMessage: (message: ChatMessage) => void) {
  const client = new WebSocketClient<ChatSchema>(`${CHAT_BASE_URL}/rooms/${roomId}`);

  client.addEventListener('message', (event) => {
    onMessage(JSON.parse(event.data));
  });

  await client.open();
  return client;
}

export function sendChatMessage(client: WebSocketClient<ChatSchema>, text: string) {
  client.send(JSON.stringify({ type: 'message', data: { text } }));
}
