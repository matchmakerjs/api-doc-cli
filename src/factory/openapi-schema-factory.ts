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
        return this.getClassMetadata(id);
    }

    getNodeSchema(node: ts.TypeNode | ts.Node, schemaMap?: { [key: string]: ts.Node }): Schema {
        let type: string;
        if (!node) {
            return;
        }
        switch (node.kind) {
            case ts.SyntaxKind.VoidKeyword:
                type = 'string';
                break;
            case ts.SyntaxKind.ObjectKeyword:
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.UnknownKeyword:
                type = 'object';
                break;
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
                    itemType = this.getNodeSchema((id && schemaMap[id.text]) || r, schemaMap);
                });
                return {
                    type: 'array',
                    items: itemType,
                    uniqueItems: false
                };
            case ts.SyntaxKind.TypeReference:
                const { identifier: id, typeArgs } = this.getIdentifierAndTypeArgs(node);
                if (id) {
                    if (schemaMap && schemaMap[id.text]) {
                        const resolvedNode = schemaMap[id.text];
                        if (resolvedNode.kind === ts.SyntaxKind.VoidKeyword) {
                            return;
                        }
                        return this.getNodeSchema(resolvedNode, schemaMap);
                    }
                    const result = this.resolveByIdentifier(id, node, typeArgs, schemaMap);
                    if (result) return result;
                }
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

    private getIdentifierAndTypeArgs(node: ts.Node) {
        let id: ts.Identifier;
        const typeArgs: ts.Node[] = [];

        node.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.Identifier) {
                id = <ts.Identifier>c;
            } else {
                typeArgs.push(c);
            }
        });
        return {
            identifier: id,
            typeArgs
        }
    }

    getClassSchema(
        declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
        typeArgs: ts.Node[],
        schemaMap: { [key: string]: ts.Node }): ObjectSchema {
        let schemaName = this.getSchemaName(declaration, typeArgs, schemaMap);
        const schema = this.schemaMap[schemaName];
        if (schema) {
            return schema;
        }
        if (!this.getClassSchemaRef(declaration, typeArgs, schemaMap)) {
            return;
        }
        return this.schemaMap[schemaName];
    }

    getClassSchemaRef(
        declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
        typeArgs: ts.Node[],
        schemaMap: { [key: string]: ts.Node }): SchemaRef {

        let schemaName = this.getSchemaName(declaration, typeArgs, schemaMap);

        let schema = this.schemaMap[schemaName];
        const schemaRef = { $ref: `#/components/schemas/${schemaName}` };
        if (!schema) {
            this.schemaMap[schemaName] = schemaRef as any;
            schema = this.createObjectSchema(declaration, typeArgs, schemaMap);
            this.schemaMap[schemaName] = schema;
        }
        return schemaRef;
    }

    private getSchemaName(
        declaration: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration,
        typeArgs: ts.Node[],
        schemaMap: { [key: string]: ts.Node }) {
        let schemaName = declaration.name.text;
        if (!typeArgs?.length) {
            return schemaName;
        }

        const names: string[] = [];
        typeArgs.forEach(arg => {
            if (arg.kind === ts.SyntaxKind.VoidKeyword) {
                names.push('Void');
            } else if (arg.kind === ts.SyntaxKind.StringKeyword) {
                names.push('String');
            } else if (arg.kind === ts.SyntaxKind.NumberKeyword
                || arg.kind === ts.SyntaxKind.BigIntKeyword) {
                names.push('Number');
            } else if (arg.kind === ts.SyntaxKind.BooleanKeyword) {
                names.push('Boolean');
            } else if (arg.kind === ts.SyntaxKind.TypeReference) {
                const { identifier, typeArgs } = this.getIdentifierAndTypeArgs(arg);
                if (!typeArgs) {
                    names.push(identifier.text);
                }
                const typeArgDeclaration = this.getClassMetadata(identifier);
                if (typeArgDeclaration) {
                    names.push(this.getSchemaName(typeArgDeclaration.declaration, typeArgs, schemaMap));
                } else if (schemaMap && schemaMap[identifier.text]) {
                    schemaMap[identifier.text].forEachChild(c => {
                        if (c.kind !== ts.SyntaxKind.Identifier) {
                            return;
                        }
                        names.push(c.getText());
                    });
                } else {
                    names.push(identifier.text);
                }
            }
        });
        return `${schemaName}Of${names.join('And')}`;
    }

    private createObjectSchema(
        declaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
        typeArgs: ts.Node[],
        parentSchemaMap: { [key: string]: ts.Node }): ObjectSchema {
        // console.log(declaration.name.text, declaration.getSourceFile().fileName, declaration.getSourceFile().hasNoDefaultLib);
        const typeParams = new Map<ts.Node, ts.Node>();
        const propertyNodes: (ts.PropertyDeclaration | ts.PropertySignature)[] = [];

        declaration.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.PropertyDeclaration || c.kind === ts.SyntaxKind.PropertySignature) {
                if (!this.isExcluded(c)) {
                    propertyNodes.push(c as any);
                }
            } else if (c.kind === ts.SyntaxKind.TypeParameter) {
                c.forEachChild(c1 => {
                    if (c1.kind !== ts.SyntaxKind.Identifier) {
                        return;
                    }
                    if (parentSchemaMap && parentSchemaMap[c1.getText()]) {
                        typeParams.set(c, parentSchemaMap[c.getText()]);
                    }
                });
                if (!typeParams.has(c)) {
                    typeParams.set(c, typeArgs[typeParams.size]);
                }
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
                schemaMap[c.getText()] = val;
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

    private isExcluded(node: ts.Node) {

        let isExcluded = false;
        node.decorators?.forEach(decorator => {
            decorator.forEachChild(c => {
                if (c.kind !== ts.SyntaxKind.CallExpression) {
                    return;
                }
                const callExpression = <ts.CallExpression>c;

                callExpression?.forEachChild(it => {
                    if (it.kind !== ts.SyntaxKind.Identifier) {
                        return;
                    }

                    const method = (<ts.Identifier>it).text;

                    if (method === 'Exclude') {
                        isExcluded = true;
                    }
                });
            })
        });
        return isExcluded;
    }

    private resolveByIdentifier(id: ts.Identifier, node: ts.TypeNode | ts.Node, typeArgs: ts.Node[], schemaMap: { [key: string]: ts.Node }): Schema {
        const classMetadata = this.typeMap.get(id.text);
        if (!classMetadata) {
            if (id.text === Buffer.name) {
                return {
                    type: 'string',
                    format: 'binary'
                };
            }
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
                enum: members.map(m => m.initializer?.getText(classMetadata.sourceFile)
                    .replace(/^['"]/g, '')
                    .replace(/['"]$/g, '')
                    || m.name.getText(classMetadata.sourceFile))
            }
        }

        if (classMetadata.declaration.getSourceFile().hasNoDefaultLib || classMetadata.declaration.name.text === Array.name) {
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
                case Buffer.name:
                    return {
                        type: 'string',
                        format: 'binary'
                    };
                case Date.name:
                    return {
                        type: 'string',
                        format: 'date-time'
                    };
                case Array.name:
                case Set.name:
                    const arrayTypeArgs: ts.Node[] = [];
                    node.forEachChild(c => {
                        if (c.kind === ts.SyntaxKind.Identifier) {
                            return;
                        } else {
                            arrayTypeArgs.push(c);
                        }
                    });
                    return {
                        type: 'array',
                        items: this.getNodeSchema(arrayTypeArgs[0], schemaMap),
                        uniqueItems: classMetadata.declaration.name.text === Set.name
                    };
            }
        }

        // console.log(classMetadata.declaration.name.text, typeArgs.length);
        return this.getClassSchemaRef(classMetadata.declaration, typeArgs, schemaMap);
    }
}
