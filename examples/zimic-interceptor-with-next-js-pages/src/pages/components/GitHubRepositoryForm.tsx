'use client';

import { FormEvent, useRef } from 'react';

import Button from '../../components/Button';
import Input from '../../components/Input';
import useHomePageSearchParams from '../hooks/useHomePageSearchParams';

function GitHubRepositoryForm() {
  const searchParams = useHomePageSearchParams();

  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const repositoryInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ownerName = ownerInputRef.current?.value;
    const repositoryName = repositoryInputRef.current?.value;

    await searchParams.set({
      owner: ownerName ?? '',
      repo: repositoryName ?? '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full">
      <Input ref={ownerInputRef} label="Owner" type="text" />
      <Input ref={repositoryInputRef} label="Repository" type="text" />
      <Button type="submit">Search</Button>
    </form>
  );
}

export default GitHubRepositoryForm;
