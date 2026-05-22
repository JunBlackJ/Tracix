"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// POST /api/import/excel
// Placeholder for Excel import functionality
// In production, use 'xlsx' package to parse uploaded files
router.post('/excel', async (req, res) => {
    res.status(501).json({
        error: 'Not implemented',
        message: 'Excel import requires file upload middleware (multer) and xlsx parsing. Add multer + xlsx packages to implement.',
    });
});
exports.default = router;
//# sourceMappingURL=import.js.map