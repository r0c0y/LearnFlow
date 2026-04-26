import("dotenv").then(dotenv => {
    dotenv.config({ path: "../.env" });
    import("./db/client.js").then(({ db }) => {
        const userId = "test_user_2";
        const lesson = {
            id: "test_123",
            title: "Test Lesson",
            subdomain: null,
            content_json: { test: 1 },
            blueprint_json: null,
            assessment_json: null,
            score: null,
            date_created: new Date().toISOString(),
            iterations_needed: 0,
            status: "complete"
        };
        
        db.execute({
            sql: `INSERT OR REPLACE INTO lessons
            (id, title, domain, subdomain, content_json, blueprint_json, assessment_json, score, date_created, date_assessed, iterations_needed, status, user_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
                lesson.id, lesson.title, lesson.domain || null, lesson.subdomain || null,
                JSON.stringify(lesson.content_json || null),
                JSON.stringify(lesson.blueprint_json || null),
                JSON.stringify(lesson.assessment_json || null),
                lesson.score || null,
                lesson.date_created || new Date().toISOString(),
                lesson.date_assessed || null,
                lesson.iterations_needed || 0,
                lesson.status || "complete",
                userId,
            ],
        }).then(() => console.log("Success")).catch(console.error);
    });
});
