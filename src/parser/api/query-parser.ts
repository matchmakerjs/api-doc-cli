import { Query, QueryParameter } from "@olaleyeone/node-rest";
import * as ts from "typescript";
import { OpenApiSchemaFactory } from "../../factory/openapi-schema-factory";
import { ArraySchema, ObjectSchema, Parameter, Schema } from "../../model/openapi";
import { getDecorators } from "../decorator-parser";

export function parseQueryParameters(schemaFactory: OpenApiSchemaFactory, methodDeclaration: ts.MethodDeclaration): Parameter[] {
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
                        const arrayTypeSchema = schemaFactory.getNodeSchema(c1);
                        if (arrayTypeSchema) {
                            schema = {
                                type: 'array',
                                items: arrayTypeSchema // needs work, consider array of dates
                            };
                        }
                    });
                } else {
                    schema = schemaFactory.getNodeSchema(c);
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

            const targetType = schemaFactory.getType(id);
            if (!targetType) {
                const simpleSchema = schemaFactory.getNodeSchema(parameter.type);
                if(simpleSchema){
                    parameters.push({
                        in: 'query',
                        name: parameter.name.getText(),
                        schema: {
                            type: (simpleSchema as ObjectSchema).type,
                            items: (simpleSchema as ArraySchema).items, // needs work, consider array of dates,
                            uniqueItems: targetType.declaration.name.text === Set.name
                        }
                    });
                }
                return;
            }
            if (targetType.declaration.kind !== ts.SyntaxKind.EnumDeclaration) {
                const schema: ObjectSchema = schemaFactory.getClassSchema(targetType.declaration, [], {});
                if (!schema || !schema.properties) {
                    return;
                }
                for (const propertyName in schema.properties) {
                    const property = schema.properties[propertyName];
                    if ((property as ObjectSchema).type) {
                        parameters.push({
                            in: 'query',
                            name: propertyName,
                            schema: {
                                type: (property as ObjectSchema).type,
                                items: (property as ArraySchema).items, // needs work, consider array of dates,
                                uniqueItems: targetType.declaration.name.text === Set.name
                            }
                        });
                    }
                }
            }
        }
    });

    return parameters;
}
