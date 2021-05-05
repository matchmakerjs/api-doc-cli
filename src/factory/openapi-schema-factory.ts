import * as ts from "typescript";
import { ClassMetadata } from "../model/class-metadata";
import { OpenApiType, Schema, SchemaRef } from "../model/openapi";

export class OpenApiSchemaFactory {
    schemaMap: { [key: string]: Schema } = {};

    getClassSchema(metadata: ClassMetadata): SchemaRef {
        let schema = this.schemaMap[metadata.declaration.name.text];
        if (!schema) {
            schema = this.createClassSchema(metadata);
            this.schemaMap[metadata.declaration.name.text] = schema;
        }
        return { schema: { $ref: `#/components/schemas/${metadata.declaration.name.text}` } };
    }

    private getTypeNodeSchema(typeNode: ts.TypeNode): OpenApiType {
        let type: string;
        switch (typeNode.kind) {
            case ts.SyntaxKind.BooleanKeyword:
                type = 'boolean';
                break;
            case ts.SyntaxKind.NumberKeyword:
            case ts.SyntaxKind.BigIntKeyword:
                type = 'number';
                break;
            case ts.SyntaxKind.StringKeyword:
                type = 'string';
                break;
        }
        if (type) return { type };

        console.log(typeNode.kind);

        // return { schema: { $ref: `#/components/schemas/${}` } };
    }

    private createClassSchema(metadata: ClassMetadata): Schema {
        const properties: {
            [key: string]: OpenApiType
        } = {};
        metadata.declaration.forEachChild(c => {
            if (c.kind !== ts.SyntaxKind.PropertyDeclaration) {
                return;
            }
            const property = <ts.PropertyDeclaration>c;
            properties[property.name.getText()] = this.getTypeNodeSchema(property.type);
        });
        return {
            type: 'object',
            properties
        }
    }

    getAll(): { [key: string]: Schema } {
        return this.schemaMap;
    }
}
