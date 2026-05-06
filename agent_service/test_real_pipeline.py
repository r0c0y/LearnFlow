import requests
import json

url = "http://localhost:8000/pipeline/generate"
payload = {
    "raw_input": {"type": "text", "content": "Explain quantum computing in simple terms."},
    "chunks": [{"id": "c1", "text": "Quantum computing is a type of computing that uses quantum-mechanical phenomena."}],
    "framework": "gagne",
    "learner_level": "beginner",
    "prior_knowledge": {"known": [], "gaps": []},
    "max_iterations": 1
}

print(f"Testing {url}...")
try:
    with requests.post(url, json=payload, stream=True) as response:
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
        else:
            for line in response.iter_lines():
                if line:
                    print(line.decode('utf-8'))
except Exception as e:
    print(f"Request failed: {e}")
