import * as ts from "typescript";

export interface TypeMetadata<T> {
    declaration: T,
    sourceFile: ts.SourceFile
}
