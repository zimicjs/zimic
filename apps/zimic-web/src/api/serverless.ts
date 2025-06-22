import app from './server/app';

async function serverlessHandler(request: Request, response: Response) {
  await app.ready();

  app.server.emit('request', request, response);
}

export default serverlessHandler;
