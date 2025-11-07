import { SMTPServer } from 'smtp-server';

const server = new SMTPServer({
  onConnect(session, callback) {
    console.dir(
      {
        event: 'onConnect',
        session,
      },
      { depth: null },
    );

    callback();
  },

  onAuth(auth, session, callback) {
    console.dir(
      {
        event: 'onAuth',
        auth,
        session,
      },
      { depth: null },
    );

    callback(null, { user: auth.username });
  },

  onMailFrom(address, session, callback) {
    console.dir(
      {
        event: 'onMailFrom',
        address,
        session,
      },
      { depth: null },
    );

    callback();
  },

  onRcptTo(address, session, callback) {
    console.dir(
      {
        event: 'onRcptTo',
        address,
        session,
      },
      { depth: null },
    );

    callback();
  },

  onData(stream, session, callback) {
    console.dir(
      {
        event: 'onData',
        session,
      },
      { depth: null },
    );

    let message = '';

    stream.on('data', (chunk) => {
      message += chunk.toString();
    });

    stream.on('end', () => {
      console.dir(
        {
          event: 'messageReceived',
          message,
        },
        { depth: null },
      );
      callback();
    });
  },

  onClose(session) {
    console.dir(
      {
        event: 'onClose',
        session,
      },
      { depth: null },
    );
  },
});

(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);

    server.listen(2525, () => {
      server.off('error', reject);
      resolve();
    });
  });

  console.log('SMTP server is listening on port 2525.');

  process.on('SIGINT', async () => {
    console.log('Shutting down SMTP server...');

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);

      server.close(() => {
        server.off('error', reject);
        resolve();
      });
    });

    process.exit(0);
  });
})();
