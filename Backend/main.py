from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import datetime

import models, schemas
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Attendance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialization
def init_db(db: Session):
    if db.query(models.Employee).count() == 0:
        employees = [
            models.Employee(name="John Doe", department="Engineering", email="john@example.com"),
            models.Employee(name="Jane Smith", department="Design", email="jane@example.com"),
            models.Employee(name="Mike Ross", department="Legal", email="mike@example.com")
        ]
        db.add_all(employees)
        db.commit()

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    init_db(db)
    return {"message": "Attendance Tracker API is running."}

# Employees
@app.get("/api/employees", response_model=List[schemas.Employee], response_model_by_alias=True)
def get_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@app.post("/api/employees", response_model=schemas.Employee, status_code=201, response_model_by_alias=True)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = models.Employee(**employee.dict())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

# Attendance
@app.get("/api/attendance", response_model=List[schemas.AttendanceRecord], response_model_by_alias=True)
def get_attendance(date: str = None, db: Session = Depends(get_db)):
    query = db.query(models.AttendanceRecord)
    if date:
        query = query.filter(models.AttendanceRecord.date == date)
    return query.all()

@app.post("/api/attendance", response_model=schemas.AttendanceRecord, status_code=201, response_model_by_alias=True)
def mark_attendance(record: schemas.AttendanceRecordBase, employee_id: int, db: Session = Depends(get_db)):
    db_record = models.AttendanceRecord(**record.dict(), employee_id=employee_id)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record
