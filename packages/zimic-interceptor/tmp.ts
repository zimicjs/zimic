import { expect } from 'vitest';
import { EmailSchema } from '@zimic/email';
import { createEmailInterceptor } from '@zimic/interceptor/email';

type Schema = EmailSchema<{}>;

const interceptor = createEmailInterceptor<Schema>({
  type: 'local',
  baseURL: 'smtp://localhost:587',
  messageSaving: {
    enabled: true,
    safeLimit: 1000,
  },
});

async function main() {
  await interceptor.start();

  expect(interceptor.isRunning).toBe(true);
  expect(interceptor.messages).toHaveLength(0);

  interceptor.server
    .on('message')
    .with({
      from: 'from@example.com',
      to: 'to@example.com',
      subject: 'Ping',
      body: '<p>Ping</p>',
      headers: { 'content-type': 'text/html' },
      auth: { username: 'username', password: 'password' },
    })
    .run((message) => {
      console.log(message);
    })
    .times(1);

  // Simulating an email sent by an application...
  await application.sendMail();

  interceptor.server
    .on('message')
    .with({
      from: { name: 'From', address: 'from@example.com' },
      to: { name: 'Receiver', address: 'to@example.com' },
      subject: 'Ping',
      body: '<p>Ping</p>',
      headers: { 'content-type': 'text/html' },
      auth: { username: 'username', password: 'password' },
    })
    .run((message) => {
      console.log(message);
    })
    .times(1);

  // Simulating an email sent by an application...
  await application.sendMail();

  expect(interceptor.messages).toHaveLength(1);

  expect(interceptor.messages[0]).toEqual({
    from: 'from@example.com',
    to: 'to@example.com',
    subject: 'Ping',
    body: '<p>Ping</p>',
    headers: { 'content-type': 'text/html' },
  });

  await interceptor.stop();

  expect(interceptor.isRunning).toBe(false);
  expect(interceptor.messages).toHaveLength(0);
}

void main();
