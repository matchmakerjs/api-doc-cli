import * as ts from "typescript";

export function getReturnType(methodDeclaration: ts.MethodDeclaration): ts.Node {
    if (methodDeclaration.type?.kind === ts.SyntaxKind.TypeReference) {
        let identifier: ts.Identifier;
        const typeArgs: ts.Node[] = [];
        methodDeclaration.type.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.Identifier) {
                identifier = <ts.Identifier>c;
            } else {
                typeArgs.push(c);
            }
        });
        if (identifier.text === 'Promise' && typeArgs.length === 1) {
            return typeArgs[0];
        }
    }
    return methodDeclaration.type;
}
