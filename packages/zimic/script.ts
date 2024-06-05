import filesystem from 'fs';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import * as ts from 'typescript';

import { HTTP_METHODS } from '@/http/types/schema';

ts.SyntaxKind;

function toPascalCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(.)([^\w\d])/g, (_, character: string, nextCharacter: string) => {
      console.log(character, nextCharacter);
      return character.toLowerCase() + nextCharacter.toUpperCase();
    })
    .replace(/^(.)/, (character) => character.toUpperCase());
}

// function changeIndentation(value: string, options: { from: number; to: number }) {
//   return value.replace(/^ +/gm, (match) => {
//     const count = match.length / options.from;
//     return ' '.repeat(count * options.to);
//   });
// }

async function main() {
  const serviceName = toPascalCase(process.argv[2]);

  const inputURL = new URL('./schema.yaml', import.meta.url);

  const nodes = await generateTypesFromOpenAPI(inputURL, {
    alphabetize: true,
    excludeDeprecated: false,
  });

  const transformedNodes = nodes
    .map((node) => {
      let newNode: ts.Node | undefined = node;

      if (ts.isInterfaceDeclaration(node) && node.name.text === 'paths') {
        const newSchemaMembers = node.members.map((member) => {
          if (ts.isPropertySignature(member) && member.type && ts.isTypeLiteralNode(member.type)) {
            const newPathMembers = member.type.members
              .map((pathMember) => {
                const supportedMethods: readonly string[] = HTTP_METHODS;

                if (ts.isPropertySignature(pathMember) && ts.isIdentifier(pathMember.name)) {
                  const upperCaseMethod = pathMember.name.text.toUpperCase();

                  if (supportedMethods.includes(upperCaseMethod)) {
                    const isNever = pathMember.type?.kind === ts.SyntaxKind.NeverKeyword;
                    if (isNever) {
                      return undefined;
                    }

                    let updatedPathMemberType = pathMember.type;

                    if (pathMember.type && ts.isTypeLiteralNode(pathMember.type)) {
                      const updatedPathMemberTypeMembers = pathMember.type.members.map((pathMemberTypeMember) => {
                        if (
                          ts.isPropertySignature(pathMemberTypeMember) &&
                          ts.isIdentifier(pathMemberTypeMember.name)
                        ) {
                          console.log(upperCaseMethod, pathMemberTypeMember.name.text);
                        }

                        return pathMemberTypeMember;
                      });

                      updatedPathMemberType = ts.factory.updateTypeLiteralNode(
                        pathMember.type,
                        ts.factory.createNodeArray(updatedPathMemberTypeMembers),
                      );
                    }

                    const updatedPathMember = ts.factory.updatePropertySignature(
                      pathMember,
                      pathMember.modifiers,
                      ts.factory.createIdentifier(upperCaseMethod),
                      pathMember.questionToken,
                      updatedPathMemberType,
                    );

                    return updatedPathMember;
                  } else {
                    return undefined;
                  }
                }

                return pathMember;
              })
              .filter((node): node is ts.TypeElement => node !== undefined);

            return ts.factory.updatePropertySignature(
              member,
              member.modifiers,
              member.name,
              member.questionToken,
              ts.factory.createTypeLiteralNode(newPathMembers),
            );
          }

          return member;
        });

        newNode = ts.factory.updateInterfaceDeclaration(
          node,
          node.modifiers,
          ts.factory.createIdentifier(`${serviceName}Schema`),
          node.typeParameters,
          node.heritageClauses,
          newSchemaMembers,
        );
      } else if (ts.isTypeAliasDeclaration(node)) {
        if (['webhooks', 'operations', '$defs'].includes(node.name.text)) {
          newNode = undefined;
        }
      }

      return newNode;
    })
    .filter((node): node is ts.Node => node !== undefined);

  const content = convertTypeASTToString(transformedNodes);
  await filesystem.promises.writeFile('./schema.ts', content);
}

void main();
