import * as ts from "typescript";

export interface MatchedDecorator {
    decorator: ts.Decorator,
    argument: ts.NodeArray<ts.Expression>
}

export function getDecorators(node: ts.HasDecorators, identifier: string): MatchedDecorator[] {
    const matched: MatchedDecorator[] = [];

    const handler = (decorator: ts.Decorator) => {
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
    };

    (node.decorators as ts.Decorator[])?.forEach(handler);
    ts.getDecorators(node)?.forEach(handler);
    return matched;
}