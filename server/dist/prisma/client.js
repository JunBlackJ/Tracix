"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Reuse client across hot-reloads in development
const prisma = global.__prisma ?? new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}
exports.default = prisma;
//# sourceMappingURL=client.js.map