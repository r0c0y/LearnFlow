import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "learnflow_default_jwt_secret";

function base64url(input) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export function signToken(payload) {
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
    const signature = base64url(
        crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
    );
    return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
    try {
        const [header, body, signature] = token.split(".");
        if (!header || !body || !signature) return null;

        const expected = base64url(
            crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest()
        );
        if (signature !== expected) return null;

        return JSON.parse(Buffer.from(body, "base64").toString("utf8"));
    } catch {
        return null;
    }
}

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
    const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(hash, "hex"));
}
