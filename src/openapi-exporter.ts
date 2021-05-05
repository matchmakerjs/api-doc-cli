import { RestController } from '@olaleyeone/node-rest';
import * as ts from "typescript";
import { OpenApiSchemaFactory } from './factory/openapi-schema-factory';
import { ClassMetadata } from './model/class-metadata';
import { Api, OpenApiContent, Path as OpenApiPath, RouteDoc, SchemaRef } from './model/openapi';
import { Endpoint, getEnpoints } from './parser/api/endpoint-parser';
import { getDecorator } from './parser/decorator-parser';
import { getClasses } from './parser/file-parser';

export function exportOpenApiDoc(entryPoint: string): Api {
    const program = ts.createProgram([entryPoint], {});
    program.getTypeChecker(); // required to start type engine
    const schemaFactory = new OpenApiSchemaFactory();
    const contentFactory = new ContentFactory(schemaFactory)

    const apiDoc: Api = {
        openapi: "3.0.1",
        info: {
            title: 'open-api doc',
            version: 'v1'
        },
        paths: getPaths(program, contentFactory)
    };
    apiDoc.components = { schemas: schemaFactory.getAll() };
    return apiDoc;
}


function getPaths(program: ts.Program, contentFactory: ContentFactory) {
    const sourceFiles = program.getSourceFiles();
    const typeMap = new Map<string, ClassMetadata>();

    const paths: { [key: string]: OpenApiPath } = {};
    sourceFiles.forEach(sourceFile => {
        const classes = getClasses(sourceFile);
        classes.forEach(c => {
            typeMap.set(c.name.text, { declaration: c, sourceFile });
        });

        classes.forEach(it => {
            if (!it.getSourceFile() || it.getSourceFile().isDeclarationFile) {
                return;
            }
            const matched = getDecorator(it, RestController.name);
            if (!matched?.length) {
                return;
            }
            const endpoints = getEnpoints(it, matched);
            // console.log(it.name.text, endpoints);
            endpoints.forEach(endpoint => {
                const routeDoc: RouteDoc = {
                    operationId: endpoint.handlerName,
                    tags: [it.name.text],
                    responses: contentFactory.getResponses(endpoint),
                    requestBody: contentFactory.getRequestBody(endpoint)
                };
                for (const prop in routeDoc) {
                    if (!(routeDoc as any)[prop]) {
                        delete (routeDoc as any)[prop];
                    }
                }

                endpoint.paths.forEach(path => {
                    paths[path] = {};
                    endpoint.methods.forEach(method => {
                        paths[path][method] = routeDoc;
                    });
                })
            });
        });
    });
    return paths;
}

class ContentFactory {
    private typeMap = new Map<string, ClassMetadata>();
    constructor(private schemaFactory: OpenApiSchemaFactory) {

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
                "application/json": this.nodeToType(endpoint.request)
            }
        };
    }

    getResponses(endpoint: Endpoint): {
        [key: string]: { description: string, content: OpenApiContent }
    } {

        return {
            '200': {
                "description": "200 response",
                "content": {
                    "application/json": this.nodeToType(endpoint.response) || {
                        schema: {
                            type: 'object',
                            nullable: true
                        }
                    }
                }
            }
        };
    }

    nodeToType(node: ts.Node | string): SchemaRef | {
        schema: {
            type: string;
        };
    } {
        if (!node) {
            return null;
        }

        if (typeof node === 'string') {
            return {
                schema: {
                    type: node
                }
            };
        } else {
            switch (node.kind) {
                case ts.SyntaxKind.StringKeyword:
                    return {
                        schema: {
                            type: 'string'
                        }
                    };
                case ts.SyntaxKind.NumberKeyword:
                case ts.SyntaxKind.BigIntKeyword:
                    return {
                        schema: {
                            type: 'number'
                        }
                    };
                case ts.SyntaxKind.BooleanKeyword:
                    return {
                        schema: {
                            type: 'boolean'
                        }
                    };
                default:
                    node.forEachChild(r => {
                        if (r.kind !== ts.SyntaxKind.Identifier) {
                            return;
                        }

                        const id = (<ts.Identifier>r).text;

                        const tsType = this.typeMap.get(id);
                        if (!tsType) {
                            return;
                        }

                        return this.schemaFactory.getClassSchema(tsType);
                    });
            }
        }

    }
}