import { ComponentProps } from 'react';

import { cn } from '../utils/styles';

type Props = ComponentProps<'button'>;

function Button({ className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-sm bg-emerald-300 px-2 py-1.5 font-medium text-slate-900 outline-hidden transition-all hover:bg-emerald-400 focus:ring-2 focus:ring-slate-400 active:bg-emerald-300',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
