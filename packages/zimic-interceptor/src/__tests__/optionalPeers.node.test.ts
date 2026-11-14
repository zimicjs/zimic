import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import packageJSON from '@@/package.json';

async function getStaticImportSpecifiers(filePath: string) {
  const sourceFile = ts.createSourceFile(
    filePath,
    await fs.promises.readFile(filePath, 'utf-8'),
    ts.ScriptTarget.Latest,
  );

  const specifiers: string[] = [];

  function visitNode(node: ts.Node) {
    const isModuleDeclaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);

    const isRequireCall =
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require';

    if (isModuleDeclaration && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (isRequireCall && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      if (ts.isStringLiteral(node.argument.literal)) {
        specifiers.push(node.argument.literal.text);
      }
    }

    ts.forEachChild(node, visitNode);
  }

  visitNode(sourceFile);

  return specifiers;
}

async function resolveRelativeImport(importerPath: string, specifier: string) {
  const importPath = path.resolve(path.dirname(importerPath), specifier);

  if (!importerPath.endsWith('.d.ts')) {
    return importPath;
  }

  // Declarations reference sibling declarations by their JavaScript path, without an extension, or by their directory.
  const isDirectory = await fs.promises.stat(importPath).then(
    (stats) => stats.isDirectory(),
    () => false,
  );

  return isDirectory ? path.join(importPath, 'index.d.ts') : importPath.replace(/(\.js)?$/, '.d.ts');
}

async function getReachablePackageImports(entryPath: string) {
  const visitedFilePaths = new Set<string>();
  const filePathsToVisit = [path.resolve(entryPath)];
  const packageImports = new Set<string>();

  while (filePathsToVisit.length > 0) {
    const filePath = filePathsToVisit.pop()!;

    if (visitedFilePaths.has(filePath)) {
      continue;
    }
    visitedFilePaths.add(filePath);

    for (const specifier of await getStaticImportSpecifiers(filePath)) {
      if (specifier.startsWith('.')) {
        filePathsToVisit.push(await resolveRelativeImport(filePath, specifier));
      } else {
        packageImports.add(specifier);
      }
    }
  }

  return packageImports;
}

const PEER_PACKAGE_NAMES = Object.keys(packageJSON.peerDependencies);

type PeerPackageName = (typeof PEER_PACKAGE_NAMES)[number];

const peerPackageNamesByEntryFile: Record<string, PeerPackageName[]> = {
  'index.d.ts': [],
  'dist/index.js': [],
  'dist/index.mjs': [],

  'http.d.ts': ['@zimic/http'],
  'dist/http.js': ['@zimic/http'],
  'dist/http.mjs': ['@zimic/http'],

  'experimental/ws.d.ts': ['@zimic/ws'],
  'dist/experimental/ws.js': [],
  'dist/experimental/ws.mjs': [],

  'experimental/socket.io.d.ts': ['@zimic/ws'],
  'dist/experimental/socket.io.js': ['engine.io-parser', 'socket.io-parser'],
  'dist/experimental/socket.io.mjs': ['engine.io-parser', 'socket.io-parser'],

  'server.d.ts': [],
  'dist/server.js': [],
  'dist/server.mjs': [],

  'bin/zimic-interceptor.js': [],
};

describe('Optional peer dependencies', () => {
  it('should declare the expected peer imports of every package entry', () => {
    const packageEntryPaths = new Set(Object.values(packageJSON.bin).map((entryPath) => path.normalize(entryPath)));

    for (const [subpath, target] of Object.entries(packageJSON.exports)) {
      if (subpath === './package.json') {
        continue;
      }

      const targetPaths = typeof target === 'string' ? [target] : Object.values(target);

      for (const targetPath of targetPaths) {
        packageEntryPaths.add(path.normalize(targetPath));
      }
    }

    expect(
      Array.from(packageEntryPaths).sort(),
      'Each package entry in the `exports` and `bin` fields of package.json must be in `peerPackageNamesByEntryFile`.',
    ).toEqual(Object.keys(peerPackageNamesByEntryFile).sort());
  });

  it.each(
    Object.entries(peerPackageNamesByEntryFile).map(([entryPath, expectedPeerPackageNames]) => ({
      entryPath,
      expectedPeerPackageNames,
    })),
  )(
    'should statically import only $expectedPeerPackageNames from $entryPath',
    async ({ entryPath, expectedPeerPackageNames }) => {
      const packageImports = Array.from(await getReachablePackageImports(entryPath));

      const peerNames = PEER_PACKAGE_NAMES.filter((peerName) =>
        packageImports.some((packageImport) => packageImport === peerName || packageImport.startsWith(`${peerName}/`)),
      );
      expect(peerNames).toEqual(expectedPeerPackageNames);
    },
  );
});
