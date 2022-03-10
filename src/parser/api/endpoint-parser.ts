import { Delete, Get, Head, Patch, Post, Put } from "@matchmakerjs/matchmaker";
import * as ts from "typescript";
import { MatchedDecorator } from "../decorator-parser";
import { getPayloadType } from "./payload-type";
import { getReturnType } from "../return-type";

export interface Endpoint {
    declaration: ts.MethodDeclaration,
    paths: string[],
    methods: string[],
    request: ts.Node,
    response: ts.Node
}

export function getEnpoints(classDeclaration: ts.ClassDeclaration | ts.InterfaceDeclaration, controllerDecorators: MatchedDecorator[]): Endpoint[] {
    const endpoints: Endpoint[] = [];

    const controllerPaths = controllerDecorators.flatMap(cd => {
        for (const arg of cd.argument) {
            if (arg.kind === ts.SyntaxKind.StringLiteral) {
                return (<ts.StringLiteral>arg).text;
            }
            if (arg.kind === ts.SyntaxKind.ArrayLiteralExpression) {
                const result: string[] = [];
                arg.forEachChild(c => {
                    if (c.kind === ts.SyntaxKind.StringLiteral) {
                        result.push((<ts.StringLiteral>c).text);
                    }
                });
                return result;
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

                const method = (<ts.Identifier>it).text;

                if ([Get.name, Head.name, Delete.name].includes(method)) {
                    routeDoc = {
                        declaration: methodDeclaration,
                        methods: [method.toLowerCase()],
                        paths: getPath(controllerPath, callExpression),
                        request: null,
                        response: getReturnType(methodDeclaration)
                    };
                }
                if ([Post.name, Put.name, Patch.name].includes(method)) {
                    routeDoc = {
                        declaration: methodDeclaration,
                        methods: [method.toLowerCase()],
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
    let handlerPaths: string[];
    if (callExpression.arguments.length) {
        const expression = callExpression.arguments[0];

        if (expression.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            expression.forEachChild(c => {
                if (c.kind === ts.SyntaxKind.PropertyAssignment) {
                    let identifier: ts.Node;
                    let value: ts.Node;
                    c.forEachChild(pc => {
                        if (pc.kind === ts.SyntaxKind.Identifier) {
                            identifier = pc;
                        } else {
                            value = pc;
                        }
                    });
                    if (identifier.getText() === 'path') {
                        handlerPaths = getPathFromExpression(value);
                    }
                }
            });
        } else {
            handlerPaths = getPathFromExpression(expression);
        }
    }
    return controllerPath.flatMap(cp => {
        return (handlerPaths || ['']).map(hp => {
            return `/${cp}/${hp}`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
        });
    });
}

function getPathFromExpression(expression: ts.Node): string[] {
    if (expression.kind === ts.SyntaxKind.StringLiteral) {
        return [(<ts.StringLiteral>expression).text];
    }
    if (expression.kind === ts.SyntaxKind.ArrayLiteralExpression) {
        const result: string[] = [];
        expression.forEachChild(c => {
            if (c.kind === ts.SyntaxKind.StringLiteral) {
                result.push((<ts.StringLiteral>c).text);
            }
        });
        if (result?.length) {
            return result;
        }
    }
    return;
}
