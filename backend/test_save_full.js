import("dotenv").then(dotenv => {
    dotenv.config({ path: "../.env" });
    import("node:http").then(() => {
        fetch("http://localhost:3001/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "r07@gmail.com", password: "password123" })
        }).then(res => res.json()).then(({ token }) => {
            fetch("http://localhost:3001/api/library/save", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    lesson: {
                        id: "lesson_12345",
                        title: "Test Lesson",
                        subdomain: null,
                        content_json: { test: 1 },
                        blueprint_json: null,
                        assessment_json: null,
                        score: 85,
                        date_assessed: new Date().toISOString(),
                        iterations_needed: 0,
                        status: "complete"
                    }
                })
            }).then(r => r.text()).then(t => {
                console.log("SAVE STATUS:", t);
                fetch("http://localhost:3001/api/library", {
                    headers: { "Authorization": `Bearer ${token}` }
                }).then(r => r.json()).then(l => console.log("LIBRARY:", l.lessons?.length || l.error));
            });
        });
    });
});
