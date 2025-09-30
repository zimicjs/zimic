import { type typegenFixtures } from './typegenFixtures';

export type TypegenFixtureType = keyof typeof typegenFixtures;

export type TypegenFixtureCaseName = keyof (typeof typegenFixtures)[TypegenFixtureType]['cases'];

export interface TypegenFixtureCase {
  input: string;
  expectedOutput?: string;
  extraArguments: string[];
  stdout?: boolean;
  url?: boolean;
  outputDirectoryExists?: boolean;
}
