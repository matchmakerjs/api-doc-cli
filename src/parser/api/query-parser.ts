import { Query, QueryParameter } from "@olaleyeone/node-rest";
import * as ts from "typescript";
import { OpenApiContentFactory } from "../../factory/openapi-content-factory";
import { Parameter, Schema } from "../../model/openapi";
import { getDecorators } from "../decorator-parser";

export function parseQueryParameters(contentFactory: OpenApiContentFactory, methodDeclaration: ts.MethodDeclaration): Parameter[] {
    const parameters: Parameter[] = [];

    methodDeclaration.parameters.forEach(parameter => {
        let matched = getDecorators(parameter, QueryParameter.name);
        if (matched.length) {
            let paramName: string;
            let schema: Schema;
            parameter.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.Identifier) {
                    return;
                }
                if (c.kind === ts.SyntaxKind.Decorator) {
                    c.forEachChild(c1 => {
                        c1.forEachChild(c2 => {
                            if (c2.kind === ts.SyntaxKind.StringLiteral) {
                                paramName = (<ts.StringLiteral>c2).text;
                            }
                        });
                    });
                    return;
                }
                if (c.kind === ts.SyntaxKind.ArrayType) {
                    c.forEachChild(c1 => {
                        const arrayTypeSchema = toSchema(c1);
                        if (arrayTypeSchema) {
                            schema = {
                                type: 'array',
                                items: arrayTypeSchema // needs work, consider array of dates
                            };
                        }
                    });
                } else {
                    schema = toSchema(c);
                }
            });
            if (schema && paramName) {
                parameters.push({
                    in: 'query',
                    name: paramName,
                    schema: schema
                });
            }
            return parameters;
        }

        matched = getDecorators(parameter, Query.name);
        if (matched.length) {

            let id: ts.Identifier;
            parameter.type.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.Identifier) {
                    id = <ts.Identifier>c;
                }
            });

            contentFactory.getType(id)?.declaration.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.PropertyDeclaration || c.kind === ts.SyntaxKind.PropertySignature) {
                    const parameter = toParameter(contentFactory, c as any);
                    if (parameter) parameters.push(...parameter);
                }
            });
        }
    });

    return parameters;
}

function toParameter(contentFactory: OpenApiContentFactory, property: ts.PropertyDeclaration | ts.PropertySignature): Parameter[] {
    if (property.type.kind === ts.SyntaxKind.TypeReference) {
        return typeReferenceToParams(contentFactory, property);
    }
    const schema = toSchema(property.type)
    if (!schema) {
        return;
    }
    return [{
        in: 'query',
        name: property.name.getText(),
        schema
    }];
}

function typeReferenceToParams(contentFactory: OpenApiContentFactory, property: ts.PropertyDeclaration | ts.PropertySignature): Parameter[] {
    let id: ts.Identifier;
    const typeArgs: ts.Node[] = [];

    property.type.forEachChild(c => {
        if (c.kind === ts.SyntaxKind.Identifier) {
            id = <ts.Identifier>c;
        }
    });

    if (!id) {
        return [];
    }
    const type = contentFactory.getType(id);
    if (!type) {
        return;
    }
    if (type.sourceFile.hasNoDefaultLib) {
        switch (type.declaration.name.text) {
            case Array.name:
            case Set.name:
                const arrayTypeArgs: ts.Node[] = [];
                property.type.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.Identifier) {
                        return;
                    } else {
                        arrayTypeArgs.push(c);
                    }
                });
                const arrayTypeSchema = arrayTypeArgs.length == 1 && toSchema(arrayTypeArgs[0]);
                if (arrayTypeSchema) {
                    return [{
                        in: 'query',
                        name: property.name.getText(),
                        schema: {
                            type: 'array',
                            items: arrayTypeSchema // needs work, consider array of dates
                        }
                    }];
                }
                break;
            case Date.name:
                return [{
                    in: 'query',
                    name: property.name.getText(),
                    schema: {
                        type: 'string',
                        format: 'date-time'
                    }
                }];
        }
    }
    switch (type.declaration.kind) {
        case ts.SyntaxKind.EnumDeclaration:
            const members: ts.EnumMember[] = [];
            type.declaration.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.EnumMember) {
                    members.push(<ts.EnumMember>c);
                }
            });
            return [{
                in: 'query',
                name: property.name.getText(),
                schema: {
                    type: 'string',
                    enum: members.map(m => m.name.getText(type.sourceFile))
                }
            }];
    }
}

function toSchema(node: ts.Node): Schema {
    switch (node.kind) {
        case ts.SyntaxKind.NumberKeyword:
        case ts.SyntaxKind.BigIntKeyword:
            return {
                type: 'number'
            };
        case ts.SyntaxKind.StringKeyword:
            return {
                type: 'string'
            };
        case ts.SyntaxKind.BooleanKeyword:
            return {
                type: 'boolean'
            };
        case ts.SyntaxKind.ArrayType:
            let arrayTypeSchema: Schema;
            node.forEachChild(c => {
                arrayTypeSchema = toSchema(c);
            });
            if (arrayTypeSchema) {
                return {
                    type: 'array',
                    items: arrayTypeSchema
                };
            }
            break;
        default:
            console.log(node.kind);
            break
    }
}
