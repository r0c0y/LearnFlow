import express from "express";
import { db } from "../db/client.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../services/auth.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [normalizedEmail] });
        if (existing.rows.length) {
            return res.status(409).json({ error: "A user with that email already exists" });
        }

        const { salt, hash } = hashPassword(password);
        const id = uuidv4();

        await db.execute({
            sql: "INSERT INTO users (id, email, password_hash, salt, created_at) VALUES (?,?,?,?,?)",
            args: [id, normalizedEmail, hash, salt, new Date().toISOString()],
        });

        const token = signToken({ user_id: id, email: normalizedEmail });
        res.json({ token, user: { id, email: normalizedEmail } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normalizedEmail] });
        const user = result.rows[0];
        if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = signToken({ user_id: user.id, email: normalizedEmail });
        res.json({ token, user: { id: user.id, email: normalizedEmail } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = verifyToken(token);
    if (!payload?.user_id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({ user: { id: payload.user_id, email: payload.email } });
});

export default router;
