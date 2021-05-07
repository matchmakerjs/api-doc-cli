import * as ts from "typescript";
import { TypeMetadata } from "../model/type-metadata";
import { Schema, ObjectSchema, SchemaRef } from "../model/openapi";

export class OpenApiSchemaFactory {
    private typeMap = new Map<string, TypeMetadata<ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration>>();
    schemaMap: { [key: string]: ObjectSchema } = {};

    addType(sourceFile: ts.SourceFile, c: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration) {
        this.typeMap.set(c.name.text, { declaration: c, sourceFile });
    }

    getType(id: ts.Identifier): TypeMetadata<ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration> {
        return this.typeMap.get(id.text);
    }

    getNodeSchema(node: ts.TypeNode | ts.Node, schemaMap?: { [key: string]: ts.Node }): Schema {
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
            case ts.SyntaxKind.ArrayType:
                let itemType: Schema;
                node.forEachChild(r => {
                    if (!schemaMap) {
                        itemType = this.getNodeSchema(r, schemaMap);
                        return;
                    }
                    let id: ts.Identifier;
                    r.forEachChild(c => {
                        if (c.kind === ts.SyntaxKind.Identifier) {
                            id = <ts.Identifier>c;
                        }
                    });
                    itemType = this.getNodeSchema(schemaMap[id.text] || r, schemaMap);
                });
                return {
                    type: 'array',
                    items: itemType
                };

            case ts.SyntaxKind.TypeReference:
                let id: ts.Identifier;
                const typeArgs: ts.Node[] = [];

                node.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.Identifier) {
                        id = <ts.Identifier>c;
                    } else if (c.kind === ts.SyntaxKind.TypeReference) {
                        typeArgs.push(c);
                    }
                });

                const result = id && this.resolveByIdentifier(id, node, typeArgs, schemaMap);
                if (result) return result;
                break;
        }
        if (type) return { type };

        console.warn('unresolved kind', node.kind);
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

    private getClassSchema(
        declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
        typeArgs: ts.Node[],
        schemaMap: { [key: string]: ts.Node }): SchemaRef {

        let schemaName = declaration.name.text;
        if (typeArgs?.length) {
            const names: string[] = [];
            typeArgs.forEach(arg => {
                arg.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.Identifier) {
                        names.push((c as ts.Identifier).text);
                    }
                });
            });
            schemaName = `${schemaName}Of${names.join('')}`;
        }
        let schema = this.schemaMap[schemaName];
        if (!schema) {
            schema = this.createObjectSchema(declaration, typeArgs, schemaMap);
            this.schemaMap[schemaName] = schema;
        }
        return { $ref: `#/components/schemas/${schemaName}` };
    }

    private createObjectSchema(declaration: ts.ClassDeclaration | ts.InterfaceDeclaration, typeArgs: ts.Node[], parentSchemaMap: { [key: string]: ts.Node }): ObjectSchema {
        // console.log(declaration.name.text, declaration.getSourceFile().fileName, declaration.getSourceFile().hasNoDefaultLib);
        const typeParams = new Map<ts.Node, ts.Node>();
        const propertyNodes: (ts.PropertyDeclaration | ts.PropertySignature)[] = [];

        declaration.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.PropertyDeclaration || c.kind === ts.SyntaxKind.PropertySignature) {
                propertyNodes.push(c as any);
            } else if (c.kind === ts.SyntaxKind.TypeParameter) {
                typeParams.set(c, typeArgs[typeParams.size]);
            }
        });

        const schemaMap: { [key: string]: ts.Node } = Object.create(parentSchemaMap || {});
        typeParams.forEach((val, key) => {
            if (!val) {
                return;
            }
            key.forEachChild(c => {
                if (c.kind !== ts.SyntaxKind.Identifier) {
                    return;
                }
                schemaMap[(c as ts.Identifier).text] = val;
            });
        });

        const properties: {
            [key: string]: Schema
        } = {};

        propertyNodes.forEach(property => {
            properties[property.name.getText()] = this.getNodeSchema(property.type, schemaMap);
        });

        return {
            type: 'object',
            properties
        }
    }

    private resolveByIdentifier(id: ts.Identifier, node: ts.TypeNode | ts.Node, typeArgs: ts.Node[], schemaMap: { [key: string]: ts.Node }): Schema {
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
                        items: this.getNodeSchema(arrayTypeArgs[0], schemaMap)
                    }
            }
        }

        // console.log(classMetadata.declaration.name.text, typeArgs.length);
        return this.getClassSchema(classMetadata.declaration, typeArgs, schemaMap);
    }
}
