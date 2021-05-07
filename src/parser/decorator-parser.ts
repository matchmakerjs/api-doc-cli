import * as ts from "typescript";

export interface MatchedDecorator {
    decorator: ts.Decorator,
    argument: ts.NodeArray<ts.Expression>
}

export function getDecorators(node: ts.Node, identifier: string): MatchedDecorator[] {
    const matched: MatchedDecorator[] = [];
    node.decorators?.forEach(decorator => {
        decorator.forEachChild(c => {
            if (c.kind !== ts.SyntaxKind.CallExpression) {
                return;
            }
            const callExpression = <ts.CallExpression>c;

            callExpression.forEachChild(it => {
                if (it.kind !== ts.SyntaxKind.Identifier) {
                    return;
                }
                if ((<ts.Identifier>it).text !== identifier) {
                    return;
                }
                matched.push({
                    decorator,
                    argument: callExpression.arguments
                });
            });
        });
    });
    return matched;
}