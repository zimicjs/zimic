import fastify from 'fastify';
import { z } from 'zod';

import { GitHubPath, GitHubRepository } from './types/github/types';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

const app = fastify({ logger: false });

const getGitHubRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
});

async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const getRepositoryPath = `/repos/${ownerName}/${repositoryName}` satisfies GitHubPath;
  const repositoryURL = `${GITHUB_API_BASE_URL}${getRepositoryPath}`;

  const repositoryResponse = await fetch(repositoryURL);

  if (repositoryResponse.status === 404) {
    return null;
  }

  const repository = (await repositoryResponse.json()) as GitHubRepository;
  return repository;
}

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

export default app;
