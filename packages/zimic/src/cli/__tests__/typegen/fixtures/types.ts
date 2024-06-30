import { typegenFixtures } from './typegenFixtures';

export type TypegenFixtureType = keyof typeof typegenFixtures;

export type TypegenFixtureCaseName = keyof (typeof typegenFixtures)[TypegenFixtureType]['cases'];

export interface TypegenFixtureCase {
  inputFileName: string;
  outputFileName: string;
  additionalArguments: string[];
}
