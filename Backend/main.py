import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, date, time
from jose import JWTError, jwt
from passlib.context import CryptContext

import models, schemas
from database import SessionLocal, engine

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "crypticsync_secret_key_change_me_in_production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CrypticSync Enterprise API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:4200").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

import json
import os

def init_db(db: Session):
    # Only seed if the database is empty
    if db.query(models.User).first():
        return

    data_path = os.path.join(os.path.dirname(__file__), "initial_data.json")
    if not os.path.exists(data_path):
        print(f"Warning: {data_path} not found. Skipping initialization.")
        return

    with open(data_path, "r") as f:
        data = json.load(f)

    # 1. Create Teams
    teams = {}
    for t in data.get("teams", []):
        team = models.Team(name=t["name"], department=t["department"])
        db.add(team)
        db.flush()
        teams[t["name"]] = team

    # 2. Create Users
    users_by_emp_id = {}
    for u in data.get("users", []):
        user = models.User(
            employee_id=u["employee_id"],
            name=u["name"],
            email=u["email"],
            hashed_password=get_password_hash(u["password"]),
            department=u["department"],
            designation=u["designation"],
            role=models.UserRole(u["role"]),
            joining_date=date.fromisoformat(u["joining_date"]),
            is_active=True
        )
        if u.get("team_name"):
            user.team_id = teams[u["team_name"]].id
        
        db.add(user)
        db.flush()
        users_by_emp_id[u["employee_id"]] = user

        # Seed initial Leave Balances
        for lt in models.LeaveType:
            if lt != models.LeaveType.WFH:
                balance = models.LeaveBalance(user_id=user.id, leave_type=lt, total_days=12, used_days=0)
                db.add(balance)

    # 3. Set Manager Relationships
    for u in data.get("users", []):
        if u.get("manager_employee_id"):
            db_user = users_by_emp_id[u["employee_id"]]
            db_user.manager_id = users_by_emp_id[u["manager_employee_id"]].id
            db.add(db_user)

    # 4. Create Holidays
    for h in data.get("holidays", []):
        holiday = models.Holiday(
            date=date.fromisoformat(h["date"]),
            holiday_name=h["name"],
            description=h["description"],
            is_optional=h["is_optional"]
        )
        db.add(holiday)
    
    # 5. Create Welcome Notifications
    for user in db.query(models.User).all():
        notif = models.Notification(
            user_id=user.id,
            title="Welcome to CrypticSync!",
            message=f"Hello {user.name}, your enterprise dashboard is now active.",
            type="info",
            is_read=False
        )
        db.add(notif)
    
    db.commit()
    print("Database initialized successfully from initial_data.json")

@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

@app.get("/")
def read_root(db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    return {
        "message": "CrypticSync Enterprise API is running.",
        "user_count": user_count
    }

@app.post("/api/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
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

@app.get("/api/users/me", response_model=schemas.UserWithTeam)
async def read_users_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(models.Team).filter(models.Team.id == current_user.team_id).first() if current_user.team_id else None
    manager = db.query(models.User).filter(models.User.id == current_user.manager_id).first() if current_user.manager_id else None
    
    return schemas.UserWithTeam(
        id=current_user.id,
        employee_id=current_user.employee_id,
        name=current_user.name,
        email=current_user.email,
        department=current_user.department,
        designation=current_user.designation,
        role=current_user.role,
        team_id=current_user.team_id,
        team_name=team.name if team else None,
        manager_id=current_user.manager_id,
        manager_name=manager.name if manager else None,
        is_active=current_user.is_active
    )

@app.get("/api/users", response_model=List[schemas.UserWithTeam])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role in [models.UserRole.CTO, models.UserRole.ADMIN]:
        return db.query(models.User).all()
    elif current_user.role == models.UserRole.MANAGER:
        direct = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
        all_users = [current_user] + direct
        for r in direct:
            if r.role == models.UserRole.MANAGER:
                sub = db.query(models.User).filter(models.User.manager_id == r.id).all()
                all_users.extend(sub)
        return all_users
    return [current_user]

@app.get("/api/reportees", response_model=List[schemas.UserWithTeam])
def get_reportees(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role in [models.UserRole.CTO, models.UserRole.ADMIN]:
        return db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    elif current_user.role == models.UserRole.MANAGER:
        direct = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
        result = list(direct)
        for user in direct:
            if user.role == models.UserRole.MANAGER:
                result.extend(db.query(models.User).filter(models.User.manager_id == user.id).all())
        return result
    return []

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
    # Regularization logic
    today = date.today()
    if attendance_data.date > today:
        raise HTTPException(status_code=400, detail="Cannot regularize future dates.")
    
    user = db.query(models.User).filter(models.User.id == attendance_data.user_id).first()
    if user and user.joining_date and attendance_data.date < user.joining_date:
        raise HTTPException(status_code=400, detail=f"Cannot regularize dates before joining date ({user.joining_date}).")

    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == attendance_data.user_id,
        models.Attendance.date == attendance_data.date
    ).first()
    
    if existing:
        existing.status = attendance_data.status
        existing.punch_in = attendance_data.punch_in
        existing.punch_out = attendance_data.punch_out
        existing.total_hours = attendance_data.total_hours
        db.commit()
        db.refresh(existing)
        return existing
    
    new_record = models.Attendance(
        user_id=attendance_data.user_id,
        date=attendance_data.date,
        status=attendance_data.status,
        punch_in=attendance_data.punch_in,
        punch_out=attendance_data.punch_out,
        total_hours=attendance_data.total_hours
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@app.post("/api/attendance/punch-in", response_model=schemas.Attendance)
def punch_in(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today()
    now = datetime.now()
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if existing and existing.punch_in:
        raise HTTPException(status_code=400, detail="Already punched in for today.")
    
    if existing:
        existing.punch_in = now
        existing.last_action_time = now
        existing.status = models.AttendanceStatus.WFH
    else:
        existing = models.Attendance(
            user_id=current_user.id,
            date=today,
            punch_in=now,
            last_action_time=now,
            status=models.AttendanceStatus.WFH
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    return existing

@app.post("/api/attendance/pause", response_model=schemas.Attendance)
def pause_attendance(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today()
    now = datetime.now()
    record = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if not record or not record.punch_in or record.punch_out:
        raise HTTPException(status_code=400, detail="No active session to pause.")
    
    if record.is_paused:
        raise HTTPException(status_code=400, detail="Already paused.")
    
    # Calculate worked time since last start/resume
    if record.last_action_time:
        diff = (now - record.last_action_time).total_seconds()
        record.total_worked_seconds += int(diff)
    
    record.is_paused = True
    record.last_action_time = now
    db.commit()
    db.refresh(record)
    return record

@app.post("/api/attendance/resume", response_model=schemas.Attendance)
def resume_attendance(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today()
    now = datetime.now()
    record = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if not record or not record.is_paused:
        raise HTTPException(status_code=400, detail="Not paused.")
    
    record.is_paused = False
    record.last_action_time = now
    db.commit()
    db.refresh(record)
    return record

@app.post("/api/attendance/punch-out", response_model=schemas.Attendance)
def punch_out(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    today = date.today()
    now = datetime.now()
    record = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.date == today
    ).first()
    
    if not record or not record.punch_in:
        raise HTTPException(status_code=400, detail="Must punch in first.")
    
    if record.punch_out:
        raise HTTPException(status_code=400, detail="Already punched out for today.")
    
    # Final calculation if not paused
    if not record.is_paused and record.last_action_time:
        diff = (now - record.last_action_time).total_seconds()
        record.total_worked_seconds += int(diff)
    
    record.punch_out = now
    record.total_hours = record.total_worked_seconds / 3600
    
    if record.total_hours < 4:
        record.status = models.AttendanceStatus.ABSENT
    elif record.total_hours < 8:
        record.status = models.AttendanceStatus.PARTIAL
    else:
        record.status = models.AttendanceStatus.PRESENT
    
    db.commit()
    db.refresh(record)
    return record

@app.get("/api/leaves/me", response_model=List[schemas.LeaveRequest])
def get_my_leaves(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.LeaveRequest).filter(models.LeaveRequest.user_id == current_user.id).all()

@app.get("/api/leaves", response_model=List[schemas.LeaveRequest])
def get_leaves(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == models.UserRole.EMPLOYEE:
        return db.query(models.LeaveRequest).filter(models.LeaveRequest.user_id == current_user.id).all()
    elif current_user.role == models.UserRole.MANAGER:
        reportee_ids = [r.id for r in db.query(models.User).filter(models.User.manager_id == current_user.id).all()]
        return db.query(models.LeaveRequest).filter(models.LeaveRequest.user_id.in_(reportee_ids)).all()
    return db.query(models.LeaveRequest).all()

@app.post("/api/leaves", response_model=schemas.LeaveRequest)
def create_leave(leave_data: schemas.LeaveRequestCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check for holidays in range
    holidays = db.query(models.Holiday).filter(
        models.Holiday.date >= leave_data.start_date,
        models.Holiday.date <= leave_data.end_date,
        models.Holiday.is_optional == False
    ).all()
    
    if holidays:
        holiday_list = ", ".join([h.holiday_name for h in holidays])
        raise HTTPException(status_code=400, detail=f"Cannot apply leave on company holidays: {holiday_list}")

    new_leave = models.LeaveRequest(
        user_id=current_user.id,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        leave_type=leave_data.leave_type,
        reason=leave_data.reason,
        status=models.LeaveStatus.PENDING
    )
    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)
    return new_leave

@app.get("/api/holidays", response_model=List[schemas.Holiday])
def get_holidays(year: Optional[int] = None, month: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Holiday)
    if year and month:
        start_date = date(year, month, 1)
        end_date = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        query = query.filter(models.Holiday.date >= start_date, models.Holiday.date < end_date)
    elif year:
        query = query.filter(models.Holiday.date >= date(year, 1, 1), models.Holiday.date <= date(year, 12, 31))
    return query.all()

# Team Management (Admin Only)
# User Management (Admin Only)
@app.get("/api/users", response_model=List[schemas.User])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.CTO]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.User).all()

@app.post("/api/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.CTO]:
        raise HTTPException(status_code=403, detail="Only admins can create users.")
    
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user.password)
    db_user = models.User(
        employee_id=user.employee_id,
        name=user.name,
        email=user.email,
        hashed_password=hashed_pwd,
        department=user.department,
        designation=user.designation,
        role=user.role,
        team_id=user.team_id,
        manager_id=user.manager_id,
        joining_date=user.joining_date
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Initialize leave balances
    for lt in models.LeaveType:
        if lt != models.LeaveType.WFH:
            balance = models.LeaveBalance(user_id=db_user.id, leave_type=lt, total_days=12, used_days=0)
            db.add(balance)
    db.commit()
    
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete users.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@app.post("/api/teams", response_model=schemas.Team)
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create teams.")
    db_team = models.Team(**team.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

# Holiday Management (Admin Only)
@app.post("/api/holidays", response_model=schemas.Holiday)
def create_holiday(holiday: schemas.HolidayBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage holidays.")
    db_holiday = models.Holiday(
        date=holiday.date,
        holiday_name=holiday.holiday_name,
        description=holiday.description,
        is_optional=holiday.is_optional
    )
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

@app.delete("/api/holidays/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can manage holidays.")
    db_holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(db_holiday)
    db.commit()
    return {"message": "Holiday deleted"}

# Leave Balances
@app.get("/api/leave-balances", response_model=List[schemas.LeaveBalance])
def get_leave_balances(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.LeaveBalance).filter(models.LeaveBalance.user_id == current_user.id).all()

# Notifications
@app.get("/api/notifications", response_model=List[schemas.Notification])
def get_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.created_at.desc()).all()

@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}