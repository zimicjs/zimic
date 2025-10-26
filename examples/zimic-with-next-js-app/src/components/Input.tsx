import { ComponentProps, ForwardedRef, forwardRef } from 'react';

import { cn } from '../utils/styles';

interface Props extends ComponentProps<'input'> {
  label: string;
}

function Input({ label, className, ...rest }: Props, ref: ForwardedRef<HTMLInputElement>) {
  return (
    <label className="flex flex-col space-y-1">
      <span className="font-medium text-slate-800">{label}</span>
      <input
        ref={ref}
        className={cn(
          'rounded-sm px-2 py-1.5 ring-2 ring-slate-300 outline-hidden transition-shadow hover:ring-slate-400 focus:ring-slate-600',
          className,
        )}
        {...rest}
      />
    </label>
  );
}

export default forwardRef(Input);
