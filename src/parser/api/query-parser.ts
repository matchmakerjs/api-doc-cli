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
                    const parameter = toParameter(c as any);
                    if (parameter) parameters.push(parameter);
                }
            });
        }
    });

    return parameters;
}

function toParameter(property: ts.PropertyDeclaration | ts.PropertySignature): Parameter {
    if (property.type.kind === ts.SyntaxKind.TypeReference) {
        return;
    }
    const schema = toSchema(property.type)
    if (!schema) {
        return;
    }
    return {
        in: 'query',
        name: property.name.getText(),
        schema
    };
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
