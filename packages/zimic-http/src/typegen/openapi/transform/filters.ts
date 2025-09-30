import isNonEmpty from '@zimic/utils/data/isNonEmpty';
import createWildcardRegexFromPath from '@zimic/utils/url/createWildcardRegexFromPath';
import fs from 'fs';
import color from 'picocolors';

import { HTTP_METHODS } from '@/types/schema';
import { ensurePathExists } from '@/utils/files';
import { logger } from '@/utils/logging';

import { TypePathFilter, TypePathFilters } from './context';

const HTTP_METHOD_OPTIONS = HTTP_METHODS.join('|');
const MODIFIER_GROUP = '(?<modifier>!?)';
const METHOD_FILTER_GROUP = `(?<method>(?:\\*|(?:${HTTP_METHOD_OPTIONS})(?:,\\s*(?:${HTTP_METHOD_OPTIONS}))*))`;
const PATH_FILTER_GROUP = '(?<path>.+)';
const FILTER_REGEX = new RegExp(`^${MODIFIER_GROUP}\\s*${METHOD_FILTER_GROUP}\\s+${PATH_FILTER_GROUP}$`, 'i');

export function parseRawFilter(rawFilter: string): TypePathFilter | undefined {
  const filterMatch = rawFilter.match(FILTER_REGEX);
  const { modifier: filterModifier, method: filteredMethodsOrWildcard, path: filteredPath } = filterMatch?.groups ?? {};

  const isValidFilter = !filteredMethodsOrWildcard || !filteredPath;

  if (isValidFilter) {
    logger.warn(`Warning: Filter could not be parsed and was ignored: ${color.yellow(rawFilter)}`);
    return undefined;
  }

  return {
    methodRegex: new RegExp(`(?:${filteredMethodsOrWildcard.toUpperCase().replace(/,/g, '|').replace(/\*/g, '.*')})`),
    pathRegex: createWildcardRegexFromPath(filteredPath),
    isNegativeMatch: filterModifier === '!',
  };
}

export function groupParsedFiltersByMatch(parsedFilters: (TypePathFilter | undefined)[]) {
  return parsedFilters.reduce<TypePathFilters>(
    (groupedFilters, filter) => {
      if (filter) {
        if (filter.isNegativeMatch) {
          groupedFilters.negative.push(filter);
        } else {
          groupedFilters.positive.push(filter);
        }
      }

      return groupedFilters;
    },
    { positive: [], negative: [] },
  );
}

export async function readPathFiltersFromFile(filePath: string) {
  await ensurePathExists(filePath, {
    errorMessage: `Could not read filter file: ${color.yellow(filePath)}`,
  });

  const fileContent = await fs.promises.readFile(filePath, 'utf-8');
  const fileContentWithoutComments = fileContent.replace(/#.*$/gm, '');

  const filters = fileContentWithoutComments.split('\n');
  return filters;
}

export function ignoreEmptyFilters(filters: string[]) {
  return filters.map((line) => line.trim()).filter(isNonEmpty);
}
