import * as ts from "typescript";
import { TypeMetadata } from "../model/type-metadata";
import { Schema, ObjectSchema, SchemaRef } from "../model/openapi";

export class OpenApiSchemaFactory {
    private typeMap = new Map<string, TypeMetadata<ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration>>();
    schemaMap: { [key: string]: ObjectSchema } = {};

    addType(sourceFile: ts.SourceFile, c: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration) {
        this.typeMap.set(c.name.text, { declaration: c, sourceFile });
    }

    getNodeSchema(node: ts.TypeNode | ts.Node): Schema {
        let type: string;
        switch (node.kind) {
            case ts.SyntaxKind.BooleanKeyword:
                type = 'boolean';
                break;
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.BigIntKeyword:
                type = 'number';
                break;
            case ts.SyntaxKind.StringKeyword:
                type = 'string';
                break;
            case ts.SyntaxKind.TypeReference:
                let id: ts.Identifier;
                node.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.Identifier) {
                        id = <ts.Identifier>c;
                    }
                });
                const result = id && this.resolveByIdentifier(id, node);
                if (result) return result;
                node.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.Identifier) {
                        return;
                    }
                    console.log(id?.text, c.kind);
                });
                break;
            case ts.SyntaxKind.ArrayType:
                let itemType: Schema;
                node.forEachChild(r => {
                    itemType = this.getNodeSchema(r);
                });
                return {
                    type: 'array',
                    items: itemType
                };
        }
        if (type) return { type };

        console.log('unresolved kind', node.kind);
        node.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.Identifier) {
                console.log((<ts.Identifier>c).text, (<ts.Identifier>c).getSourceFile()?.fileName);
            } else {
                console.log(c.kind);
            }
        });
        console.log('-------------------');
    }

    getAll(): { [key: string]: ObjectSchema } {
        return this.schemaMap;
    }

    getClassMetadata(id: ts.Identifier): TypeMetadata<ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration> {
        return this.typeMap.get(id.text);
    }

    private getClassSchema(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): SchemaRef {
        let schema = this.schemaMap[declaration.name.text];
        if (!schema) {
            schema = this.createObjectSchema(declaration);
            this.schemaMap[declaration.name.text] = schema;
        }
        return { $ref: `#/components/schemas/${declaration.name.text}` };
    }

    private createObjectSchema(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration): ObjectSchema {
        // console.log(declaration.name.text, declaration.getSourceFile().fileName, declaration.getSourceFile().hasNoDefaultLib);
        const properties: {
            [key: string]: Schema
        } = {};
        declaration.forEachChild(c => {
            let property: ts.PropertyDeclaration | ts.PropertySignature;

            if (c.kind === ts.SyntaxKind.PropertyDeclaration) {
                property = <ts.PropertyDeclaration>c;
            } else if (c.kind === ts.SyntaxKind.PropertySignature) {
                property = <ts.PropertySignature>c;
            }

            if (property) {
                properties[property.name.getText()] = this.getNodeSchema(property.type);
            }
        });
        return {
            type: 'object',
            properties
        }
    }

    private resolveByIdentifier(id: ts.Identifier, node: ts.TypeNode | ts.Node): Schema {
        const classMetadata = this.typeMap.get(id.text);
        if (!classMetadata) {
            return;
        }

        if (classMetadata.declaration.kind === ts.SyntaxKind.EnumDeclaration) {
            const members: ts.EnumMember[] = [];
            classMetadata.declaration.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.EnumMember) {
                    members.push(<ts.EnumMember>c);
                }
            });
            return {
                type: 'string',
                enum: members.map(m => m.name.getText(classMetadata.sourceFile))
            }
        }
        if (classMetadata.declaration.getSourceFile().hasNoDefaultLib) {
            switch (classMetadata.declaration.name.text) {
                // case Promise.name:
                //     const promiseTypeArgs: ts.Node[] = [];
                //     node.forEachChild(c => {
                //         if (c.kind === ts.SyntaxKind.Identifier) {
                //             return
                //         } else {
                //             promiseTypeArgs.push(c);
                //         }
                //     });
                //     return this.getNodeSchema(promiseTypeArgs[0])
                case Date.name:
                    return {
                        type: 'string',
                        format: 'date-time'
                    }
                case Array.name:
                    const arrayTypeArgs: ts.Node[] = [];
                    node.forEachChild(c => {
                        if (c.kind === ts.SyntaxKind.Identifier) {
                            return
                        } else {
                            arrayTypeArgs.push(c);
                        }
                    });
                    return {
                        type: 'array',
                        items: this.getNodeSchema(arrayTypeArgs[0])
                    }
            }
        }
        return this.getClassSchema(classMetadata.declaration);
    }
}
