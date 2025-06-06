import isNonEmpty from '@zimic/utils/data/isNonEmpty';
import createRegExpFromWildcardPath from '@zimic/utils/url/createRegExpFromWildcardPath';
import filesystem from 'fs/promises';
import path from 'path';
import color from 'picocolors';

import { HTTP_METHODS } from '@/types/schema';
import { logger } from '@/utils/logging';

import { TypePathFilters } from './context';

const HTTP_METHOD_OPTIONS = HTTP_METHODS.join('|');
const MODIFIER_GROUP = '(?<modifier>!?)';
const METHOD_FILTER_GROUP = `(?<method>(?:\\*|(?:${HTTP_METHOD_OPTIONS})(?:,\\s*(?:${HTTP_METHOD_OPTIONS}))*))`;
const PATH_FILTER_GROUP = '(?<path>.+)';
const FILTER_REGEX = new RegExp(`^${MODIFIER_GROUP}\\s*${METHOD_FILTER_GROUP}\\s+${PATH_FILTER_GROUP}$`, 'i');

interface ParsedTypePathFilter {
  expression: RegExp;
  isNegativeMatch: boolean;
}

export function parseRawFilter(rawFilter: string): ParsedTypePathFilter | undefined {
  const filterMatch = rawFilter.match(FILTER_REGEX);
  const { modifier: filterModifier, method: filteredMethodsOrWildcard, path: filteredPath } = filterMatch?.groups ?? {};

  const isValidFilter = !filteredMethodsOrWildcard || !filteredPath;
  if (isValidFilter) {
    logger.warn(`Warning: Filter could not be parsed and was ignored: ${color.yellow(rawFilter)}`);
    return undefined;
  }

  const methodFilterGroup = `(?:${filteredMethodsOrWildcard.toUpperCase().replace(/,/g, '|').replace(/\*/g, '.*')}) `;
  const isNegativeMatch = filterModifier === '!';

  return {
    expression: createRegExpFromWildcardPath(filteredPath, { prefix: methodFilterGroup }),
    isNegativeMatch,
  };
}

export function groupParsedFiltersByMatch(parsedFilters: (ParsedTypePathFilter | undefined)[]) {
  return parsedFilters.reduce<TypePathFilters>(
    (groupedFilters, filter) => {
      if (filter) {
        if (filter.isNegativeMatch) {
          groupedFilters.negative.push(filter.expression);
        } else {
          groupedFilters.positive.push(filter.expression);
        }
      }

      return groupedFilters;
    },
    { positive: [], negative: [] },
  );
}

export async function readPathFiltersFromFile(filePath: string) {
  const fileContent = await filesystem.readFile(path.resolve(filePath), 'utf-8');
  const fileContentWithoutComments = fileContent.replace(/#.*$/gm, '');

  const filters = fileContentWithoutComments.split('\n');
  return filters;
}

export function ignoreEmptyFilters(filters: string[]) {
  return filters.map((line) => line.trim()).filter(isNonEmpty);
}
