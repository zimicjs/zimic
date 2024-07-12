import type { HttpServiceSchemaPath } from 'zimic/http';

import { GitHubComponents, GitHubSchema } from './typegen/generated';

export type GitHubRepository = GitHubComponents['schemas']['full-repository'];

export type GitHubPath = HttpServiceSchemaPath<GitHubSchema>;
