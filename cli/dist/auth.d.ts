import type { TokenPayload } from './types.js';
export declare function loadToken(): string | null;
export declare function saveToken(token: string): void;
export declare function decodeTokenPayload(token: string): TokenPayload | null;
export declare function interactiveLogin(serverUrl: string): Promise<{
    token: string;
    payload: TokenPayload;
}>;
//# sourceMappingURL=auth.d.ts.map