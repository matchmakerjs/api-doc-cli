import * as ts from "typescript";

export function getMethods(classDeclaration: ts.ClassDeclaration): ts.MethodDeclaration[] {
    const methods: ts.MethodDeclaration[] = [];
    classDeclaration.forEachChild(m => {
        if (m.kind !== ts.SyntaxKind.MethodDeclaration) {
            return;
        }
        methods.push(<ts.MethodDeclaration>m);
    });
    return methods;
}