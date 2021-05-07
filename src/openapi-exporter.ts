import { RestController, parseUrl } from '@olaleyeone/node-rest';
import * as ts from "typescript";
import { OpenApiContentFactory } from './factory/openapi-content-factory';
import { OpenApiSchemaFactory } from './factory/openapi-schema-factory';
import { Api, OpenApiPath, RouteDoc } from './model/openapi';
import { getEnpoints } from './parser/api/endpoint-parser';
import { parseQueryParameters } from './parser/api/query-parser';
import { getDecorators, MatchedDecorator } from './parser/decorator-parser';
import { getClasses } from './parser/file-parser';

export function exportOpenApiDoc(entryPoint: string): Api {
    const program = ts.createProgram([entryPoint], {});
    program.getTypeChecker(); // required to start type engine
    const schemaFactory = new OpenApiSchemaFactory();
    const contentFactory = new OpenApiContentFactory(schemaFactory)

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

function getPaths(program: ts.Program, contentFactory: OpenApiContentFactory): { [key: string]: OpenApiPath } {
    const sourceFiles = program.getSourceFiles();
    const controllerMap = new Map<ts.ClassDeclaration | ts.InterfaceDeclaration, MatchedDecorator[]>();

    const paths: { [key: string]: OpenApiPath } = {};

    sourceFiles.forEach(sourceFile => {
        const classes = getClasses(sourceFile);
        classes.forEach(c => {
            contentFactory.addType(sourceFile, c);
            if (c.kind === ts.SyntaxKind.EnumDeclaration) {
                return;
            }

            if (!c.getSourceFile() || c.getSourceFile().isDeclarationFile) {
                return;
            }
            const matched = getDecorators(c, RestController.name);
            if (!matched?.length) {
                return;
            }
            controllerMap.set(c, matched);
        });
    });

    const operationsMap: { [key: string]: number } = {};
    controllerMap.forEach((val, key) => {
        const endpoints = getEnpoints(key, val);
        endpoints.forEach(endpoint => {
            const routeDoc: RouteDoc = {
                operationId: endpoint.declaration.name.getText(),
                tags: [key.name.text],
                responses: contentFactory.getResponses(endpoint),
                requestBody: contentFactory.getRequestBody(endpoint),
                parameters: parseQueryParameters(contentFactory, endpoint.declaration)
            };
            for (const prop in routeDoc) {
                if (!(routeDoc as any)[prop]) {
                    delete (routeDoc as any)[prop];
                }
            }


            endpoint.paths.forEach(path => {
                const segments = parseUrl(path);
                const signature = `/${segments.map(segment => {
                    let result = '';
                    segment.parts.forEach(part => {
                        if (typeof part === 'string') {
                            result += part;
                            return;
                        }
                        result += `{${part.name}}`;
                        routeDoc.parameters.push({
                            name: part.name,
                            in: 'path',
                            required: true,
                            schema: {
                                type: 'string'
                            }
                        });
                    });
                    return result;
                }).join('/')}`;

                if (!paths[signature]) {
                    paths[signature] = {};
                }
                endpoint.methods.forEach(method => {
                    const it: RouteDoc = Object.assign({}, routeDoc);
                    let operationId = endpoint.declaration.name.getText();
                    if (operationId in operationsMap) {
                        operationsMap[operationId] = operationsMap[operationId] + 1;
                        it.operationId = `${operationId}${operationsMap[operationId]}`;
                        // console.warn(`duplicate method name ${endpoint.handlerName}`);
                    } else {
                        operationsMap[operationId] = 0;
                    }

                    paths[signature][method] = it;
                    console.log(`${it.operationId}:`, method.toUpperCase(), signature);
                });
            })
        });
    });
    return paths;
}
