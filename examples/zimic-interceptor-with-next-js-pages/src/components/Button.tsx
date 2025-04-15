import clsx from 'clsx';
import { ComponentProps } from 'react';

type Props = ComponentProps<'button'>;

function Button({ className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={clsx(
        'px-2 py-1.5 bg-emerald-300 rounded-sm transition-all outline-hidden focus:ring-2 focus:ring-slate-400 hover:bg-emerald-400 active:bg-emerald-300 font-medium text-slate-900',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
