/**
 * Shared lazy Groq client.
 * By the time any route handler calls getGroq(), server.js has already
 * run dotenv.config(), so GROQ_API_KEY is available.
 */
import OpenAI from "openai";
import Groq from "groq-sdk";

let _groq = null;
let _groqSdk = null;

/** OpenAI-compatible client pointed at Groq API */
export function getGroq() {
    if (!_groq) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY is not set. Add it to learnflow/.env");
        }
        _groq = new OpenAI({
            apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });
    }
    return _groq;
}

/** Native Groq SDK (for Whisper audio) */
export function getGroqSdk() {
    if (!_groqSdk) {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY is not set. Add it to learnflow/.env");
        }
        _groqSdk = new Groq({ apiKey });
    }
    return _groqSdk;
}

export const FAST_MODEL = "llama-3.1-8b-instant";
export const LARGE_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // TODO: revert to "llama-3.3-70b-versatile" when quota resets
