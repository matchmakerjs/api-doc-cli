import { Get, Post } from "@olaleyeone/node-rest";
import * as ts from "typescript";
import { MatchedDecorator } from "../decorator-parser";
import { getPayloadType } from "./payload-type";
import { getReturnType } from "../return-type";

export interface Endpoint {
    handlerName: string,
    paths: string[],
    methods: string[],
    request: ts.Node | string,
    response: ts.Node | string
}

export function getEnpoints(classDeclaration: ts.ClassDeclaration, controllerDecorators: MatchedDecorator[]): Endpoint[] {
    const endpoints: Endpoint[] = [];

    const controllerPaths = controllerDecorators.map(cd => {
        for (const arg of cd.argument) {
            if (arg.kind === ts.SyntaxKind.StringLiteral) {
                return (<ts.StringLiteral>arg).text;
            }
        }
        return '';
    });

    classDeclaration.forEachChild(m => {
        if (m.kind !== ts.SyntaxKind.MethodDeclaration) {
            return;
        }

        const doc = getRouteDoc(controllerPaths, <ts.MethodDeclaration>m);
        if (doc) {
            endpoints.push(doc);
        }
    });
    return endpoints;
}

function getRouteDoc(controllerPath: string[], methodDeclaration: ts.MethodDeclaration): Endpoint {
    let routeDoc: Endpoint;
    methodDeclaration.decorators?.forEach(decorator => {
        decorator.forEachChild(c => {
            if (c.kind !== ts.SyntaxKind.CallExpression) {
                return;
            }
            const callExpression = <ts.CallExpression>c;

            callExpression.forEachChild(it => {
                if (it.kind !== ts.SyntaxKind.Identifier) {
                    return;
                }

                if ((<ts.Identifier>it).text === Get.name) {
                    routeDoc = {
                        handlerName: methodDeclaration.name.getText(),
                        methods: ['get'],
                        paths: getPath(controllerPath, callExpression),
                        request: null,
                        response: getReturnType(methodDeclaration)
                    };
                }
                if ((<ts.Identifier>it).text === Post.name) {
                    routeDoc = {
                        handlerName: methodDeclaration.name.getText(),
                        methods: ['post'],
                        paths: getPath(controllerPath, callExpression),
                        request: getPayloadType(methodDeclaration),
                        response: getReturnType(methodDeclaration)
                    };
                }
            });
        });
    });
    return routeDoc;
}

function getPath(controllerPath: string[], callExpression: ts.CallExpression): string[] {
    let handlerPaths = ['']
    if (callExpression.arguments.length) {
        const expression = callExpression.arguments[0];
        if (expression.kind === ts.SyntaxKind.StringLiteral) {
            handlerPaths = [(<ts.StringLiteral>expression).text];
        }
    }
    return controllerPath.flatMap(cp => {
        return handlerPaths.map(hp => {
            return `${cp}/${hp}`.replace(/\/{2,}/g, '/');
        });
    });
}
