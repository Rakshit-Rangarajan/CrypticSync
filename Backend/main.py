from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date
from jose import JWTError, jwt
from passlib.context import CryptContext

import models, schemas
from database import SessionLocal, engine

# Security Configuration
SECRET_KEY = "crypticsync_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CrypticSync Enterprise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Helpers
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=email)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

# Sequential ID Helper
def generate_employee_id(db: Session):
    last_user = db.query(models.User).order_by(models.User.id.desc()).first()
    if not last_user:
        return "EMP-1001"
    last_id = int(last_user.employee_id.split("-")[1])
    return f"EMP-{last_id + 1}"

# Initialization
def init_db(db: Session):
    # Check for Admin
    admin = db.query(models.User).filter(models.User.employee_id == "EMP-1000").first()
    admin_pass = get_password_hash("admin123")
    if not admin:
        admin = models.User(
            employee_id="EMP-1000",
            name="System Administrator",
            email="admin@crypticsync.com",
            hashed_password=admin_pass,
            department="IT",
            designation="CTO",
            role=models.UserRole.ADMIN,
            is_active=True
        )
        db.add(admin)
    else:
        admin.email = "admin@crypticsync.com"
        admin.hashed_password = admin_pass
        admin.role = models.UserRole.ADMIN
    db.commit()

    # Check for Manager
    manager = db.query(models.User).filter(models.User.employee_id == "EMP-1001").first()
    manager_pass = get_password_hash("manager123")
    if not manager:
        # Get admin id for manager_id
        admin_id = db.query(models.User).filter(models.User.employee_id == "EMP-1000").first().id
        manager = models.User(
            employee_id="EMP-1001",
            name="Jane Manager",
            email="jane@crypticsync.com",
            hashed_password=manager_pass,
            department="Engineering",
            designation="Engineering Manager",
            role=models.UserRole.MANAGER,
            manager_id=admin_id,
            is_active=True
        )
        db.add(manager)
    else:
        manager.email = "jane@crypticsync.com"
        manager.hashed_password = manager_pass
        manager.role = models.UserRole.MANAGER
    db.commit()

    # Check for Employee
    employee = db.query(models.User).filter(models.User.employee_id == "EMP-1002").first()
    employee_pass = get_password_hash("employee123")
    if not employee:
        # Get manager id for manager_id
        manager_id = db.query(models.User).filter(models.User.employee_id == "EMP-1001").first().id
        employee = models.User(
            employee_id="EMP-1002",
            name="John Employee",
            email="john@crypticsync.com",
            hashed_password=employee_pass,
            department="Engineering",
            designation="Software Engineer",
            role=models.UserRole.EMPLOYEE,
            manager_id=manager_id,
            is_active=True
        )
        db.add(employee)
    else:
        employee.email = "john@crypticsync.com"
        employee.hashed_password = employee_pass
        employee.role = models.UserRole.EMPLOYEE
    db.commit()

    # Add Holidays if empty
    if db.query(models.Holiday).count() == 0:
        holidays = [
            models.Holiday(date=date(2024, 1, 1), holiday_name="New Year's Day"),
            models.Holiday(date=date(2024, 12, 25), holiday_name="Christmas")
        ]
        db.add_all(holidays)
        db.commit()

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    init_db(db)
    user_count = db.query(models.User).count()
    return {
        "message": "CrypticSync Enterprise API is running.",
        "user_count": user_count
    }

# Auth Endpoints
@app.post("/api/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Ensure DB is initialized
    init_db(db)
    
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
        # Also try employee_id
        user = db.query(models.User).filter(models.User.employee_id == form_data.username).first()
        
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/employee ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# Users Management
@app.get("/api/users", response_model=List[schemas.User])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == models.UserRole.ADMIN:
        return db.query(models.User).all()
    elif current_user.role == models.UserRole.MANAGER:
        return db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    return [current_user]

# Attendance
@app.get("/api/attendance", response_model=List[schemas.Attendance])
def get_attendance(date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Attendance)
    if current_user.role == models.UserRole.EMPLOYEE:
        query = query.filter(models.Attendance.user_id == current_user.id)
    if date:
        query = query.filter(models.Attendance.date == date)
    return query.all()

@app.post("/api/attendance", response_model=schemas.Attendance)
def mark_attendance(attendance_data: schemas.AttendanceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check if record already exists for this user and date
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == attendance_data.user_id,
        models.Attendance.date == attendance_data.date
    ).first()
    
    if existing:
        existing.status = attendance_data.status
        existing.punch_in = attendance_data.punch_in
        existing.punch_out = attendance_data.punch_out
        db.commit()
        db.refresh(existing)
        return existing
    
    new_record = models.Attendance(
        user_id=attendance_data.user_id,
        date=attendance_data.date,
        status=attendance_data.status,
        punch_in=attendance_data.punch_in,
        punch_out=attendance_data.punch_out
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

# Leave Requests
@app.get("/api/leaves", response_model=List[schemas.LeaveRequest])
def get_leaves(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == models.UserRole.EMPLOYEE:
        return db.query(models.LeaveRequest).filter(models.LeaveRequest.user_id == current_user.id).all()
    elif current_user.role == models.UserRole.MANAGER:
        return db.query(models.LeaveRequest).filter(models.LeaveRequest.approver_id == current_user.id).all()
    return db.query(models.LeaveRequest).all()

# Holidays
@app.get("/api/holidays", response_model=List[schemas.Holiday])
def get_holidays(db: Session = Depends(get_db)):
    return db.query(models.Holiday).all()
