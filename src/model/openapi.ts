export type OpenApiContent = {
    [key: string]: {
        schema: (SchemaRef | ArraySchema) & { nullable?: boolean };
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
    $ref: string;
};

export type ArraySchema = {
    type: string;
    items?: SchemaRef | ArraySchema
};

export interface ObjectSchema {
    type: string,
    format?: string,
    enum?: string[],
    properties?: {
        [key: string]: SchemaRef | ArraySchema | ObjectSchema;
    }
}

export type Schema = SchemaRef | ArraySchema | ObjectSchema;

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
        schemas: { [key: string]: ObjectSchema }
    }
}