#!/usr/bin/env python3
"""
Quick startup helper — runs all 3 services concurrently.
Usage: python3 start.py
"""
import subprocess, sys, os, signal

ROOT = os.path.dirname(os.path.abspath(__file__))

processes = []
try:
    # Agent service
    processes.append(subprocess.Popen(
        ["python3", "-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
        cwd=os.path.join(ROOT, "agent_service"),
    ))
    print("✅ Agent service started on http://localhost:8000")

    # Backend
    processes.append(subprocess.Popen(
        ["node", "--watch", "server.js"],
        cwd=os.path.join(ROOT, "backend"),
    ))
    print("✅ Backend started on http://localhost:3001")

    # Frontend
    processes.append(subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=os.path.join(ROOT, "frontend"),
    ))
    print("✅ Frontend started on http://localhost:5173")

    print("\n🚀 LearnFlow is running! Open http://localhost:5173\nPress Ctrl+C to stop all services.\n")
    for p in processes:
        p.wait()
except KeyboardInterrupt:
    print("\n👋 Stopping all services...")
    for p in processes:
        p.terminate()
    sys.exit(0)
