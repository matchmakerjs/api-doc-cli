export type OpenApiContent = {
    [key: string]: SchemaRef | {
        schema: {
            type: string;
            nullable?: boolean
        };
    };
};

export interface Path {
    [key: string]: RouteDoc
}

export interface RouteDoc {
    tags?: string[],
    operationId?: string,
    requestBody?: {
        content: OpenApiContent,
        required: boolean
    },
    responses: {
        [key: string]: { description: string, content: OpenApiContent }
    }
}

export interface Response {
    description: string,
    content: OpenApiContent
}

export type SchemaRef = {
    schema: {
        $ref: string;
    };
};

export interface Schema {
    type: string,
    properties?: {
        [key: string]: OpenApiType;
    }
}

export type OpenApiType = SchemaRef | Schema;

export interface Info {
    title: string,
    description?: string,
    version: string,
    contact?: Contact
}

export interface Contact {
    name?: string,
    email?: string
    url?: string
}

export interface Api {
    openapi: string,
    info: Info,
    servers?: any[],
    paths: { [key: string]: Path },
    components?: {
        schemas: { [key: string]: Schema }
    }
}