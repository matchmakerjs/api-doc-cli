import * as ts from "typescript";
import { OpenApiContent } from "../model/openapi";
import { TypeMetadata } from "../model/type-metadata";
import { Endpoint } from "../parser/api/endpoint-parser";
import { OpenApiSchemaFactory } from "./openapi-schema-factory";

export class OpenApiContentFactory {
    constructor(private schemaFactory: OpenApiSchemaFactory) {

    }

    addType(sourceFile: ts.SourceFile, c: ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration) {
        this.schemaFactory.addType(sourceFile, c);
    }

    getType(id: ts.Identifier): TypeMetadata<ts.ClassDeclaration | ts.InterfaceDeclaration | ts.EnumDeclaration> {
        return this.schemaFactory.getType(id);
    }

    getRequestBody(endpoint: Endpoint): {
        content: OpenApiContent,
        required: boolean
    } {

        if (!endpoint.request) {
            return;
        }

        return {
            required: true,
            content: {
                "application/json": { schema: this.schemaFactory.getNodeSchema(endpoint.request) }
            }
        };
    }

    getResponses(endpoint: Endpoint): {
        [key: string]: { description: string, content: OpenApiContent }
    } {
        const responseType = this.schemaFactory.getNodeSchema(endpoint.response);
        return {
            '200': {
                "description": "200 response",
                "content": {
                    "application/json": {
                        schema: responseType || {
                            type: 'object',
                            nullable: true
                        }
                    }
                }
            }
        };
    }
}