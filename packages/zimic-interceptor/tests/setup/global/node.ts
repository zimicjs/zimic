import { setup as sharedSetup, teardown as sharedTeardown } from './shared';

export async function setup() {
  await sharedSetup();
}

export async function teardown() {
  await sharedTeardown();
}
