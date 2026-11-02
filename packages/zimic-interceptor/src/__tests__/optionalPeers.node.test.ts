import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function getStaticImportSpecifiers(filePath: string) {
  const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf-8'), ts.ScriptTarget.Latest);
  const specifiers: string[] = [];

  function visit(node: ts.Node) {
    const isModuleDeclaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
    const isRequireCall =
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require';

    if (isModuleDeclaration && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (isRequireCall && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;

      if (ts.isStringLiteral(literal)) {
        specifiers.push(literal.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return specifiers;
}

function resolveRelativeImport(importerPath: string, specifier: string) {
  const importPath = path.resolve(path.dirname(importerPath), specifier);
  const isDeclaration = importerPath.endsWith('.d.ts');

  // Declarations reference sibling declarations by their JavaScript path or without an extension.
  return isDeclaration ? importPath.replace(/(\.js)?$/, '.d.ts') : importPath;
}

function getReachablePackageImports(entryPath: string) {
  const visitedFilePaths = new Set<string>();
  const filePathsToVisit = [path.resolve(entryPath)];
  const packageImports = new Set<string>();

  while (filePathsToVisit.length > 0) {
    const filePath = filePathsToVisit.pop()!;

    if (visitedFilePaths.has(filePath)) {
      continue;
    }
    visitedFilePaths.add(filePath);

    for (const specifier of getStaticImportSpecifiers(filePath)) {
      if (specifier.startsWith('.')) {
        filePathsToVisit.push(resolveRelativeImport(filePath, specifier));
      } else {
        packageImports.add(specifier);
      }
    }
  }

  return packageImports;
}

describe('Optional peer dependencies', () => {
  // Guards the negative cases below, which would also pass if the import scan stopped recognizing the emitted syntax.
  it.each([
    { entryPath: 'dist/http.js', peerName: '@zimic/http' },
    { entryPath: 'dist/http.mjs', peerName: '@zimic/http' },
    { entryPath: 'http.d.ts', peerName: '@zimic/http' },
    { entryPath: 'experimental/ws.d.ts', peerName: '@zimic/ws' },
  ])('should statically import $peerName from $entryPath', ({ entryPath, peerName }) => {
    const packageImports = getReachablePackageImports(entryPath);

    expect(packageImports).toContain(peerName);
  });

  it.each([
    { entryPath: 'dist/http.js', peerName: '@zimic/ws' },
    { entryPath: 'dist/http.mjs', peerName: '@zimic/ws' },
    { entryPath: 'http.d.ts', peerName: '@zimic/ws' },

    { entryPath: 'dist/experimental/ws.js', peerName: '@zimic/http' },
    { entryPath: 'dist/experimental/ws.mjs', peerName: '@zimic/http' },
    { entryPath: 'experimental/ws.d.ts', peerName: '@zimic/http' },

    // The server loads its HTTP runtime with a dynamic import, so remote WebSocket interceptors work without
    // `@zimic/http` installed.
    { entryPath: 'dist/server.js', peerName: '@zimic/http' },
    { entryPath: 'dist/server.js', peerName: '@zimic/ws' },
    { entryPath: 'dist/server.mjs', peerName: '@zimic/http' },
    { entryPath: 'dist/server.mjs', peerName: '@zimic/ws' },
    { entryPath: 'server.d.ts', peerName: '@zimic/http' },
    { entryPath: 'server.d.ts', peerName: '@zimic/ws' },

    { entryPath: 'bin/zimic-interceptor.js', peerName: '@zimic/http' },
    { entryPath: 'bin/zimic-interceptor.js', peerName: '@zimic/ws' },
  ])('should not statically import $peerName from $entryPath', ({ entryPath, peerName }) => {
    const packageImports = Array.from(getReachablePackageImports(entryPath));

    const peerImports = packageImports.filter(
      (packageImport) => packageImport === peerName || packageImport.startsWith(`${peerName}/`),
    );

    expect(peerImports).toEqual([]);
  });
});
