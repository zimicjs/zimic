import type { HttpSchema } from '@zimic/http';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  owner: { login: string };
}

export type GitHubSchema = HttpSchema<{
  '/repos/:owner/:name': {
    GET: {
      response: {
        200: { body: GitHubRepository };
        403: { body: { message: string } };
        404: { body: { message: string } };
      };
    };
  };
}>;
