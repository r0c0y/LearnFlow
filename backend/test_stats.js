import("dotenv").then(dotenv => {
    dotenv.config({ path: "../.env" });
    import("./db/client.js").then(({ db }) => {
        const userId = "test_user_2";
        db.execute({
            sql: `
              INSERT INTO stats (user_id, total_lessons, last_active) VALUES (?, 1, date('now'))
              ON CONFLICT(user_id) DO UPDATE SET
                total_lessons = total_lessons + 1,
                last_active = date('now'),
                streak_days = CASE
                  WHEN last_active = date('now', '-1 day') THEN streak_days + 1
                  WHEN last_active = date('now') THEN streak_days
                  ELSE 1
                END
            `,
            args: [userId]
        }).then(() => console.log("Stats Success")).catch(console.error);
    });
});
