import { app, initSchema } from '../server.js';

export default async function handler(req, res) {
    // Ensure database is initialized
    await initSchema();
    // Use the express app to handle the request
    return app(req, res);
}
