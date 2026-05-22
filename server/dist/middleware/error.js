"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const config_1 = require("../config");
function errorHandler(err, req, res, next) {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'Validation error',
            details: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    if (err instanceof Error) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
        if (config_1.config.nodeEnv === 'development') {
            res.status(500).json({ error: err.message, stack: err.stack });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }
    res.status(500).json({ error: 'Unknown error' });
}
//# sourceMappingURL=error.js.map