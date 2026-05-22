import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    organizationId: string;
    email: string;
    role: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(roles: string[]): Promise<(req: Request, res: Response, next: NextFunction) => void>;
export declare function generateToken(payload: JwtPayload): string;
//# sourceMappingURL=auth.d.ts.map