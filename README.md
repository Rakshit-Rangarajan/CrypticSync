# CrypticSync

CrypticSync is a modern, enterprise-grade Attendance and Workforce Management System. It provides a seamless interface for managing employees, tracking attendance, handling leave requests, and generating insightful reports.

## 🚀 Technology Stack

### Frontend
- **Angular 21**: Robust, signal-based reactivity and enterprise-grade architecture.
- **Vanilla CSS**: Premium, custom-crafted UI with a dark mode aesthetic and glassmorphism.
- **Lucide Icons**: Clean, modern iconography.

### Backend
- **FastAPI (Python)**: High-performance asynchronous API framework.
- **SQLAlchemy (SQLite)**: Flexible ORM with a portable, zero-config database.
- **JWT Authentication**: Secure, stateless user authorization.
- **SMTP Integration**: Automated onboarding and password reset workflows.

## ✨ Key Features
- **Role-Based Access Control**: Hierarchical permissions (SuperAdmin, Admin, CTO, Manager, Employee).
- **Automated Attendance**: Intelligent punch-in/out logic with overtime and break calculations.
- **Interactive Dashboard**: Real-time stats and notifications.
- **Email Workflows**: Secure password resets and new employee invitations.
- **Modern Landing Page**: Comprehensive project overview and feedback system.

## 🛠️ Setup Instructions

### Backend
1. Navigate to the `Backend` directory.
2. Create a virtual environment: `python -m venv .venv`
3. Activate it: `source .venv/bin/activate` (or `.venv\Scripts\activate` on Windows).
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and fill in your SMTP credentials.
6. Run the server: `uvicorn main:app --reload`

### Frontend
1. Navigate to the `Frontend` directory.
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Access the app at `http://localhost:4200`

## 📄 Documentation
- API Documentation: Available at `http://localhost:8000/docs` once the backend is running.
- Project Approach: See the "Approach" section on the Landing Page.

---
Built by Rakshit Rangarajan
