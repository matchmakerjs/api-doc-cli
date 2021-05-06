import { RestController } from '@olaleyeone/node-rest';
import * as ts from "typescript";
import { OpenApiContentFactory } from './factory/openapi-content-factory';
import { OpenApiSchemaFactory } from './factory/openapi-schema-factory';
import { Api, Path as OpenApiPath, RouteDoc } from './model/openapi';
import { getEnpoints } from './parser/api/endpoint-parser';
import { getDecorator, MatchedDecorator } from './parser/decorator-parser';
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


function getPaths(program: ts.Program, contentFactory: OpenApiContentFactory) {
    const sourceFiles = program.getSourceFiles();
    const controllerMap = new Map<ts.ClassDeclaration | ts.InterfaceDeclaration, MatchedDecorator[]>();

    const paths: { [key: string]: OpenApiPath } = {};
    sourceFiles.forEach(sourceFile => {
        const classes = getClasses(sourceFile);
        classes.forEach(c => {
            if (c.kind === ts.SyntaxKind.EnumDeclaration) {
                contentFactory.addEnum(sourceFile, c);
                return;
            }
            contentFactory.addClass(sourceFile, c);

            if (!c.getSourceFile() || c.getSourceFile().isDeclarationFile) {
                return;
            }
            const matched = getDecorator(c, RestController.name);
            if (!matched?.length) {
                return;
            }
            controllerMap.set(c, matched);
        });
    });

    controllerMap.forEach((val, key) => {
        const endpoints = getEnpoints(key, val);
        // console.log(it.name.text, endpoints);
        endpoints.forEach(endpoint => {
            // console.log(endpoint.paths);
            const routeDoc: RouteDoc = {
                operationId: endpoint.handlerName,
                tags: [key.name.text],
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
    return paths;
}
