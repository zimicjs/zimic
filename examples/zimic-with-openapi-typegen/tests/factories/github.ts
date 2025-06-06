import { GitHubRepository } from '../../src/clients/github/types';

export function createGitHubRepository(partialRepository: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 1,
    name: 'zimic-example',
    node_id: 'R_kgDOKwY08A',
    full_name: 'zimicjs/zimic-example',
    private: false,
    html_url: 'https://github.com/zimicjs/zimic-example',
    owner: {
      login: 'zimicjs',
      id: 161985413,
      node_id: 'O_kgDOCaezhQ',
      avatar_url: 'https://avatars.githubusercontent.com/u/161985413?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/zimicjs',
      html_url: 'https://github.com/zimicjs',
      followers_url: 'https://api.github.com/users/zimicjs/followers',
      following_url: 'https://api.github.com/users/zimicjs/following{/other_user}',
      gists_url: 'https://api.github.com/users/zimicjs/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/zimicjs/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/zimicjs/subscriptions',
      organizations_url: 'https://api.github.com/users/zimicjs/orgs',
      repos_url: 'https://api.github.com/users/zimicjs/repos',
      events_url: 'https://api.github.com/users/zimicjs/events{/privacy}',
      received_events_url: 'https://api.github.com/users/zimicjs/received_events',
      type: 'Organization',
      user_view_type: 'public',
      site_admin: false,
    },
    description: 'Next-gen TypeScript-first HTTP integrations',
    fork: false,
    url: 'https://api.github.com/repos/zimicjs/zimic-example',
    forks_url: 'https://api.github.com/repos/zimicjs/zimic-example/forks',
    keys_url: 'https://api.github.com/repos/zimicjs/zimic-example/keys{/key_id}',
    collaborators_url: 'https://api.github.com/repos/zimicjs/zimic-example/collaborators{/collaborator}',
    teams_url: 'https://api.github.com/repos/zimicjs/zimic-example/teams',
    hooks_url: 'https://api.github.com/repos/zimicjs/zimic-example/hooks',
    issue_events_url: 'https://api.github.com/repos/zimicjs/zimic-example/issues/events{/number}',
    events_url: 'https://api.github.com/repos/zimicjs/zimic-example/events',
    assignees_url: 'https://api.github.com/repos/zimicjs/zimic-example/assignees{/user}',
    branches_url: 'https://api.github.com/repos/zimicjs/zimic-example/branches{/branch}',
    tags_url: 'https://api.github.com/repos/zimicjs/zimic-example/tags',
    blobs_url: 'https://api.github.com/repos/zimicjs/zimic-example/git/blobs{/sha}',
    git_tags_url: 'https://api.github.com/repos/zimicjs/zimic-example/git/tags{/sha}',
    git_refs_url: 'https://api.github.com/repos/zimicjs/zimic-example/git/refs{/sha}',
    trees_url: 'https://api.github.com/repos/zimicjs/zimic-example/git/trees{/sha}',
    statuses_url: 'https://api.github.com/repos/zimicjs/zimic-example/statuses/{sha}',
    languages_url: 'https://api.github.com/repos/zimicjs/zimic-example/languages',
    stargazers_url: 'https://api.github.com/repos/zimicjs/zimic-example/stargazers',
    contributors_url: 'https://api.github.com/repos/zimicjs/zimic-example/contributors',
    subscribers_url: 'https://api.github.com/repos/zimicjs/zimic-example/subscribers',
    subscription_url: 'https://api.github.com/repos/zimicjs/zimic-example/subscription',
    commits_url: 'https://api.github.com/repos/zimicjs/zimic-example/commits{/sha}',
    git_commits_url: 'https://api.github.com/repos/zimicjs/zimic-example/git/commits{/sha}',
    comments_url: 'https://api.github.com/repos/zimicjs/zimic-example/comments{/number}',
    issue_comment_url: 'https://api.github.com/repos/zimicjs/zimic-example/issues/comments{/number}',
    contents_url: 'https://api.github.com/repos/zimicjs/zimic-example/contents/{+path}',
    compare_url: 'https://api.github.com/repos/zimicjs/zimic-example/compare/{base}...{head}',
    merges_url: 'https://api.github.com/repos/zimicjs/zimic-example/merges',
    archive_url: 'https://api.github.com/repos/zimicjs/zimic-example/{archive_format}{/ref}',
    downloads_url: 'https://api.github.com/repos/zimicjs/zimic-example/downloads',
    issues_url: 'https://api.github.com/repos/zimicjs/zimic-example/issues{/number}',
    pulls_url: 'https://api.github.com/repos/zimicjs/zimic-example/pulls{/number}',
    milestones_url: 'https://api.github.com/repos/zimicjs/zimic-example/milestones{/number}',
    notifications_url: 'https://api.github.com/repos/zimicjs/zimic-example/notifications{?since,all,participating}',
    labels_url: 'https://api.github.com/repos/zimicjs/zimic-example/labels{/name}',
    releases_url: 'https://api.github.com/repos/zimicjs/zimic-example/releases{/id}',
    deployments_url: 'https://api.github.com/repos/zimicjs/zimic-example/deployments',
    created_at: '2023-11-21T21:14:37Z',
    updated_at: '2025-04-16T00:56:59Z',
    pushed_at: '2025-04-15T23:40:42Z',
    git_url: 'git://github.com/zimicjs/zimic-example.git',
    ssh_url: 'git@github.com:zimicjs/zimic-example.git',
    clone_url: 'https://github.com/zimicjs/zimic-example.git',
    svn_url: 'https://github.com/zimicjs/zimic-example',
    homepage: 'https://github.com/zimicjs/zimic-example',
    size: 4377,
    stargazers_count: 16,
    watchers_count: 16,
    language: 'TypeScript',
    has_issues: true,
    has_projects: true,
    has_downloads: true,
    has_wiki: true,
    has_pages: false,
    has_discussions: true,
    forks_count: 3,
    mirror_url: null,
    archived: false,
    disabled: false,
    open_issues_count: 26,
    license: {
      key: 'mit',
      name: 'MIT License',
      spdx_id: 'MIT',
      url: 'https://api.github.com/licenses/mit',
      node_id: 'MDc6TGljZW5zZTEz',
    },
    allow_forking: true,
    is_template: false,
    web_commit_signoff_required: false,
    topics: [
      'api',
      'fetch',
      'http',
      'mock',
      'msw',
      'openapi',
      'service-workers',
      'tests',
      'typegen',
      'types',
      'typescript',
    ],
    visibility: 'public',
    forks: 3,
    open_issues: 26,
    watchers: 16,
    default_branch: 'canary',
    temp_clone_token: null,
    custom_properties: {},
    organization: {
      login: 'zimicjs',
      id: 161985413,
      node_id: 'O_kgDOCaezhQ',
      avatar_url: 'https://avatars.githubusercontent.com/u/161985413?v=4',
      gravatar_id: '',
      url: 'https://api.github.com/users/zimicjs',
      html_url: 'https://github.com/zimicjs',
      followers_url: 'https://api.github.com/users/zimicjs/followers',
      following_url: 'https://api.github.com/users/zimicjs/following{/other_user}',
      gists_url: 'https://api.github.com/users/zimicjs/gists{/gist_id}',
      starred_url: 'https://api.github.com/users/zimicjs/starred{/owner}{/repo}',
      subscriptions_url: 'https://api.github.com/users/zimicjs/subscriptions',
      organizations_url: 'https://api.github.com/users/zimicjs/orgs',
      repos_url: 'https://api.github.com/users/zimicjs/repos',
      events_url: 'https://api.github.com/users/zimicjs/events{/privacy}',
      received_events_url: 'https://api.github.com/users/zimicjs/received_events',
      type: 'Organization',
      user_view_type: 'public',
      site_admin: false,
    },
    network_count: 3,
    subscribers_count: 2,
    anonymous_access_enabled: false,
    ...partialRepository,
  };
}
