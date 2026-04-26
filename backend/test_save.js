async function run() {
  const loginRes = await fetch("http://localhost:3001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "r07@gmail.com", password: "password123" })
  });
  const { token } = await loginRes.json();
  
  if (!token) return console.log("Login failed");

  const saveRes = await fetch("http://localhost:3001/api/library/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
        lesson: {
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
        }
    })
  });
  
  const text = await saveRes.text();
  console.log("SAVE RESPONSE:", saveRes.status, text);
}
run();
