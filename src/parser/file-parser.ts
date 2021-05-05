import * as ts from "typescript";

export function getClasses(file: ts.SourceFile): (ts.ClassDeclaration | ts.InterfaceDeclaration)[] {
    const result: (ts.ClassDeclaration | ts.InterfaceDeclaration)[] = [];
    file.forEachChild(node => {
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            result.push(<ts.ClassDeclaration>node);
        } else if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            result.push(<ts.InterfaceDeclaration>node);
        }
    });
    return result;
}