import { verifyToken } from "../services/auth.js";

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = verifyToken(token);
    if (!payload?.user_id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Normalize: JWT stores user_id, but routes use req.user.id
    req.user = { ...payload, id: payload.user_id };
    next();
}
