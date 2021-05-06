import * as ts from "typescript";

export interface ClassMetadata<T> {
    declaration: T,
    sourceFile: ts.SourceFile
}
