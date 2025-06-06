'use client';

import { FormEvent, useRef } from 'react';

import Button from '../../components/Button';
import Input from '../../components/Input';
import useHomePageSearchParams from '../hooks/useHomePageSearchParams';

function GitHubRepositoryForm() {
  const { setHomePageSearchParams } = useHomePageSearchParams();

  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const repositoryInputRef = useRef<HTMLInputElement | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setHomePageSearchParams({
      owner: ownerInputRef.current?.value ?? '',
      repo: repositoryInputRef.current?.value ?? '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col space-y-4">
      <Input ref={ownerInputRef} label="Owner" type="text" />
      <Input ref={repositoryInputRef} label="Repository" type="text" />
      <Button type="submit">Search</Button>
    </form>
  );
}

export default GitHubRepositoryForm;
