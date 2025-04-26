import { ComponentProps } from 'react';

export interface ImageSVGProps extends ComponentProps<'svg'> {
  role: 'img';
  title: string;
}

export interface HiddenSVGProps extends ComponentProps<'svg'> {
  'aria-hidden': 'true';
  title?: never;
}

export type SVGProps = ImageSVGProps | HiddenSVGProps;
