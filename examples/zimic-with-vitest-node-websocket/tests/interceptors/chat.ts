import { createWebSocketInterceptor } from '@zimic/interceptor/experimental/ws';

import { CHAT_BASE_URL, ChatSchema } from '@/clients/chat';

const chatInterceptor = createWebSocketInterceptor<ChatSchema>({
  baseURL: CHAT_BASE_URL,
});

export default chatInterceptor;
