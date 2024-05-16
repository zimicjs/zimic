'use client';

import { FormEvent, useRef } from 'react';

import Button from '../../components/Button';
import Input from '../../components/Input';
import useHomePageSearchParams from '../hooks/useHomePageSearchParams';

function GitHubRepositoryForm() {
  const searchParams = useHomePageSearchParams();

  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const repositoryInputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    searchParams.set({
      owner: ownerInputRef.current?.value ?? '',
      repo: repositoryInputRef.current?.value ?? '',
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
