import { db } from "./client.js";

export async function initSchema() {
    await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domain TEXT,
      subdomain TEXT,
      content_json TEXT,
      blueprint_json TEXT,
      assessment_json TEXT,
      score INTEGER,
      date_created TEXT,
      date_assessed TEXT,
      iterations_needed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'complete'
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lesson_folders (
      lesson_id TEXT,
      folder_id TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      lesson_id TEXT,
      review_date TEXT,
      score INTEGER
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY DEFAULT 1,
      total_lessons INTEGER DEFAULT 0,
      total_time_minutes INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_active TEXT
    );
  `);

    // Seed default folders if none exist
    const { rows } = await db.execute("SELECT COUNT(*) as cnt FROM folders");
    if (rows[0].cnt === 0) {
        const defaultFolders = ["Tech", "Finance", "Language", "Science", "Uncategorized"];
        for (const name of defaultFolders) {
            const id = name.toLowerCase().replace(/ /g, "_") + "_default";
            await db.execute({
                sql: "INSERT OR IGNORE INTO folders (id, name, parent_id, created_at) VALUES (?,?,?,?)",
                args: [id, name, null, new Date().toISOString()],
            });
        }
    }

    console.log("✅ Database schema initialized");
}
