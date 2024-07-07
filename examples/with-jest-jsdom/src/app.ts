import type { JSONValue } from 'zimic/http';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export const GITHUB_API_BASE_URL = 'https://api.github.com';

export type GitHubRepository = JSONValue<{
  id: number;
  full_name: string;
  html_url: string;
}>;

async function fetchGitHubRepository(ownerName: string, repositoryName: string) {
  const repositoryURL = `${GITHUB_API_BASE_URL}/repos/${ownerName}/${repositoryName}`;
  const repositoryResponse = await fetch(repositoryURL);

  if (repositoryResponse.status === 404) {
    return null;
  }

  const repository = (await repositoryResponse.json()) as GitHubRepository;
  return repository;
}

function renderApp() {
  const container = document.createElement('div');

  container.innerHTML = `
    <form>
      <label>
        Owner <input type="text" name="owner" />
      </label>
      <label>
        Repository <input type="text" name="repository" />
      </label>
      <button type="submit">Search</button>
    </form>

    <section>
      <h1 id="repository-name"></h1>
      <a id="repository-url"></a>
    </section>
  `;

  const form = container.querySelector('form')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const ownerNameInput = form.elements.namedItem('owner') as HTMLInputElement;
    const ownerName = ownerNameInput.value;

    const repositoryNameInput = form.elements.namedItem('repository') as HTMLInputElement;
    const repositoryName = repositoryNameInput.value;

    const repository = await fetchGitHubRepository(ownerName, repositoryName);

    const repositoryNameElement = container.querySelector('#repository-name')!;
    const repositoryURLElement = container.querySelector('#repository-url')!;

    if (repository) {
      repositoryNameElement.textContent = repository.full_name;
      repositoryURLElement.setAttribute('href', repository.html_url);
      repositoryURLElement.textContent = repository.html_url;
    } else {
      repositoryNameElement.textContent = 'Repository not found';
      repositoryURLElement.textContent = '';
    }
  });

  document.body.appendChild(container);
}

export default renderApp;
