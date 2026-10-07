/**
 * Who made this. Empty fields are simply not shown.
 * `handle` is what's displayed on the right of each link row.
 */
export type IconName = 'globe' | 'github' | 'phone' | 'mail';

export interface Link {
  label: string;
  href: string;
  handle: string;
  icon: IconName;
}

export const ME = {
  name: 'Nishant Choudhary',
  /** Shown under the name. */
  location: 'HSR Layout, Bangalore',
  /** One or two sentences. */
  bio: '',
  github: 'blacurrant',
  /** Phone and email open the app on phones; on desktop they copy instead. */
  phone: { display: '+91 94178 01998', tel: '+919417801998' },
  email: 'nishantchoudhary.dev@gmail.com',
  links: [
    { label: 'Portfolio', href: 'https://www.nishant.world/', handle: 'nishant.world', icon: 'globe' },
    { label: 'GitHub', href: 'https://github.com/blacurrant', handle: '@blacurrant', icon: 'github' },
  ] as Link[],
};

/** Served locally so the nav never waits on github.com; the initial shows until it loads. */
export const AVATAR = '/avatar.png';

/** What to call you when no name is set. */
export const DISPLAY_NAME = ME.name || ME.github;
