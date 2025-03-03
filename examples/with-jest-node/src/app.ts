import fastify from 'fastify';
import { z } from 'zod';

import { fetchGitHubRepository } from './clients/github';

const app = fastify({ logger: false });

const getGitHubRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
});

app.get('/github/repositories/:owner/:name', async (request, reply) => {
  const { owner: ownerName, name: repositoryName } = getGitHubRepositorySchema.parse(request.params);
  const repository = await fetchGitHubRepository(ownerName, repositoryName);

  if (repository === null) {
    return reply.status(404).send();
  }

  return reply.status(200).send({
    id: repository.id,
    fullName: repository.full_name,
    homepageURL: repository.html_url,
  });
});

app.setErrorHandler(async (error, _request, reply) => {
  console.error(error);
  await reply.status(500).send({ message: 'Internal server error' });
});

export default app;
