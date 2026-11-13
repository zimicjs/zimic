import { ReactNode } from 'react';

import { cn } from '@/utils/styles';

import { Example } from './packages';
import Snippet from './Snippet';

interface Props {
  install: string;
  example: Example;
  reversed?: boolean;
  children: ReactNode;
}

/** Text on one side, with the install command and a code example on the other. */
function ExamplePanel({ install, example, reversed = false, children }: Props) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
      <div className={cn('flex flex-col items-start gap-6 text-left', reversed && 'lg:order-last')}>{children}</div>

      <div className="flex min-w-0 flex-col gap-4">
        <Snippet language="bash" code={install} />
        <Snippet title={example.title} code={example.code} />
      </div>
    </div>
  );
}

export default ExamplePanel;
