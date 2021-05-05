import { RequestBody } from "@olaleyeone/node-rest";
import * as ts from "typescript";

export function getPayloadType(methodDeclaration: ts.MethodDeclaration): ts.Node {
    const payloadParams = methodDeclaration.parameters.filter(param => {
        return param.decorators?.filter(decorator => {
            let val = false;
            decorator.forEachChild(c => {
                if (c.kind !== ts.SyntaxKind.CallExpression) {
                    return;
                }
                c.forEachChild(it => {
                    if (it.kind !== ts.SyntaxKind.Identifier) {
                        return;
                    }
                    if ((<ts.Identifier>it).text === RequestBody.name) {
                        val = true;
                    }
                });
            });
            return val;
        }).length;
    });
    if (payloadParams.length !== 1) {
        return null;
    }

    let identifier: ts.Identifier;
    let type: ts.Node;

    payloadParams[0].forEachChild(c => {
        if (c.kind === ts.SyntaxKind.Identifier) {
            identifier = <ts.Identifier>c;
        }
        if (c.kind === ts.SyntaxKind.TypeReference) {
            type = c;
        }
    });

    return type;
}
