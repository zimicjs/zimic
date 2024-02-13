import fastify from 'fastify';
import { z } from 'zod';

export const GITHUB_API_BASE_URL = 'https://api.github.com';

const app = fastify({ logger: false });

const getGitHubRepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
});

export interface GitHubRepository {
  id: number;
  name: string;
  topics: string[];
}

async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const repositoryURL = `${GITHUB_API_BASE_URL}/repos/${ownerName}/${repositoryName}`;
  const repositoryResponse = await fetch(repositoryURL);

  if (repositoryResponse.status === 404) {
    return null;
  }

  const completeRepository = (await repositoryResponse.json()) as GitHubRepository & Record<string, unknown>;
  const repository: GitHubRepository = {
    id: completeRepository.id,
    name: completeRepository.name,
    topics: completeRepository.topics,
  };
  return repository;
}

app.get('/github/repositories/:owner/:name', async (request, reply) => {
  const { owner: ownerName, name: repositoryName } = getGitHubRepositorySchema.parse(request.params);
  const repository = await fetchGitHubRepository(ownerName, repositoryName);

  if (repository === null) {
    return reply.status(404).send();
  }
  return reply.status(200).send(repository);
});

export default app;
