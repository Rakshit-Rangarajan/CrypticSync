@echo off
title CrypticSync Services

echo Starting Backend API (FastAPI)...
start cmd /k "cd /d "%~dp0Backend" && if not exist .venv (python -m venv .venv) && call .venv\Scripts\activate && pip install -r requirements.txt && uvicorn main:app --reload --port 8000"

echo Starting Angular Frontend...
start cmd /k "cd /d "%~dp0Frontend" && npm start"

echo Services are starting in new windows...
echo Frontend should be available at http://localhost:4200
echo Backend API (FastAPI) should be available at http://localhost:8000/docs
pause
