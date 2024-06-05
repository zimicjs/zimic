export interface AuthSchema {
    "/user": {
        /**
         * Create user
         * @description This can only be done by the logged in user.
         */
        POST: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            /** @description Created user object */
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["User"];
                };
            };
            responses: {
                /** @description successful operation */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["User"];
                    };
                };
            };
        };
    };
}
export interface components {
    schemas: {
        User: {
            /** @example john@email.com */
            email?: string;
            /** @example John */
            firstName?: string;
            /**
             * Format: int64
             * @example 10
             */
            id?: number;
            /** @example James */
            lastName?: string;
            /** @example 12345 */
            password?: string;
            /** @example 12345 */
            phone?: string;
            /** @example theUser */
            username?: string;
            /**
             * Format: int32
             * @description User Status
             * @example 1
             */
            userStatus?: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
