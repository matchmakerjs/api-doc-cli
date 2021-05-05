import * as ts from "typescript";

export function getClasses(file: ts.SourceFile): ts.ClassDeclaration[] {
    const result: ts.ClassDeclaration[] = [];
    file.forEachChild(node => {
        if (node.kind !== ts.SyntaxKind.ClassDeclaration) {
            return;
        }
        result.push(<ts.ClassDeclaration>node);
    });
    return result;
}