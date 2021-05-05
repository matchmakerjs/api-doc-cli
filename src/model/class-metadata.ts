import * as ts from "typescript";

export interface ClassMetadata {
    declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile
}
