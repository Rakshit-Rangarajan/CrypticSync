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

import models, schemas, random, secrets
from database import SessionLocal, engine
import email_utils

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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account has been deactivated. Please contact HR.")
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
            is_active=True
        )
        if u.get("team_name"):
            user.team_id = teams[u["team_name"]].id
        
        db.add(user)
        db.flush()
        users_by_emp_id[u["employee_id"]] = user

        # Seed initial Leave Balances
        if user.role != models.UserRole.SUPER_ADMIN:
            for lt in models.LeaveType:
                if lt != models.LeaveType.WFH and lt != models.LeaveType.COMPENSATORY_OFF:
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
        
        # 6. Seed 30 days of historical attendance for realism
        if user.role != models.UserRole.SUPER_ADMIN:
            for i in range(1, 31):
                hist_date = date.today() - timedelta(days=i)
                # Skip weekends
                if hist_date.weekday() >= 5: continue
            
            # Randomly assign status (80% Present, 10% WFH, 10% Absent)
            rand = random.random()
            if rand < 0.7:
                status = "PRESENT"
            elif rand < 0.9:
                status = "WFH"
            else:
                status = "ABSENT"
                
            if status != "ABSENT":
                db.add(models.Attendance(
                    user_id=user.id,
                    date=hist_date,
                    status=status,
                    punch_in=datetime.combine(hist_date, time(9, 0)),
                    punch_out=datetime.combine(hist_date, time(18, 0)),
                    total_worked_seconds=32400 # 9 hours
                ))
            else:
                db.add(models.Attendance(user_id=user.id, date=hist_date, status="ABSENT"))

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

@app.post("/api/auth/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        
        reset_url = f"http://localhost:4200/reset-password?token={token}"
        email_utils.send_reset_email(user.email, reset_url, user.name, is_new_user=False)
        
    return {"message": "If the email is registered, a password reset link has been sent."}

@app.post("/api/auth/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.reset_token == req.token,
        models.User.reset_token_expires > datetime.utcnow()
    ).first()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    user.hashed_password = get_password_hash(req.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}

@app.post("/api/contact")
def submit_contact(request: schemas.ContactRequest):
    email_utils.send_contact_email(
        name=request.name,
        from_email=request.email,
        rating=request.rating,
        message=request.message
    )
    return {"message": "Thank you for your feedback!"}

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
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact HR.",
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
    if current_user.role in [models.UserRole.CTO, models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        return db.query(models.User).all()
    elif current_user.role == models.UserRole.MANAGER:
        direct = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
        all_users = [current_user] + direct
        for r in direct:
            if r.role == models.UserRole.TEAM_LEAD:
                sub = db.query(models.User).filter(models.User.manager_id == r.id).all()
                all_users.extend(sub)
        return all_users
    elif current_user.role == models.UserRole.TEAM_LEAD:
        direct = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
        return [current_user] + direct
    return [current_user]

@app.get("/api/reportees", response_model=List[schemas.UserWithTeam])
def get_reportees(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        return db.query(models.User).all()
    elif current_user.role == models.UserRole.CTO:
        return db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    elif current_user.role == models.UserRole.MANAGER:
        direct = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
        result = list(direct)
        for user in direct:
            if user.role == models.UserRole.TEAM_LEAD:
                result.extend(db.query(models.User).filter(models.User.manager_id == user.id).all())
        return result
    elif current_user.role == models.UserRole.TEAM_LEAD:
        return db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    return []

@app.get("/api/reportees/attendance")
def get_reportees_attendance(weekStart: date, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Get all reportees
    reportees = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    
    # 2. Get attendance for the week
    week_end = weekStart + timedelta(days=6)
    result = []
    for user in reportees:
        attendance = db.query(models.Attendance).filter(
            models.Attendance.user_id == user.id,
            models.Attendance.date >= weekStart,
            models.Attendance.date <= week_end
        ).all()
        
        result.append({
            "user": user,
            "attendance": attendance
        })
    return result

@app.get("/api/attendance", response_model=List[schemas.Attendance])
def get_attendance(date: Optional[date] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Attendance)
    if current_user.role == models.UserRole.EMPLOYEE:
        query = query.filter(models.Attendance.user_id == current_user.id)
    if date:
        query = query.filter(models.Attendance.date == date)
    return query.all()

@app.get("/api/attendance/{user_id}/monthly", response_model=List[schemas.Attendance])
def get_monthly_attendance(user_id: int, year: int, month: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from datetime import date
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
        
    if current_user.role == models.UserRole.EMPLOYEE and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(models.Attendance).filter(
        models.Attendance.user_id == user_id,
        models.Attendance.date >= start_date,
        models.Attendance.date < end_date
    ).all()

@app.post("/api/attendance", response_model=schemas.Attendance)
def mark_attendance(attendance_data: schemas.AttendanceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Regularization logic
    today = date.today()
    if attendance_data.date > today:
        raise HTTPException(status_code=400, detail="Cannot regularize future dates.")
    
    user_id = attendance_data.user_id or current_user.id
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    
    # Determine initial status
    reg_status = models.RegularizationStatus.APPROVED
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.CTO]:
        reg_status = models.RegularizationStatus.PENDING

    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == user_id,
        models.Attendance.date == attendance_data.date
    ).first()
    
    if existing:
        existing.status = attendance_data.status
        existing.punch_in = attendance_data.punch_in
        existing.punch_out = attendance_data.punch_out
        existing.total_hours = attendance_data.total_hours
        existing.reg_status = reg_status
        existing.reason = attendance_data.reason
    else:
        existing = models.Attendance(
            user_id=user_id,
            date=attendance_data.date,
            status=attendance_data.status,
            punch_in=attendance_data.punch_in,
            punch_out=attendance_data.punch_out,
            total_hours=attendance_data.total_hours,
            reg_status=reg_status,
            reason=attendance_data.reason
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)

    # NOTIFICATION LOGIC
    if reg_status == models.RegularizationStatus.PENDING:
        # Notify only reporting manager
        if target_user and target_user.manager_id:
            notif = models.Notification(
                user_id=target_user.manager_id,
                title="Regularization Pending",
                message=f"{target_user.name} submitted a regularization request for {attendance_data.date}",
                type="ATTENDANCE"
            )
            db.add(notif)
    else:
        # If approved manually by someone else, notify the user
        if current_user.id != user_id:
            notif = models.Notification(
                user_id=user_id,
                title="Attendance Updated",
                message=f"Your attendance for {attendance_data.date} was updated by {current_user.name}",
                type="ATTENDANCE"
            )
            db.add(notif)
            
    db.commit()
    return existing

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
    
    is_holiday = db.query(models.Holiday).filter(models.Holiday.date == today).first() is not None
    
    def credit_overtime(hours: float):
        record.overtime_hours = hours
        leave_balance = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.user_id == current_user.id,
            models.LeaveBalance.leave_type == models.LeaveType.COMPENSATORY_OFF
        ).first()
        if leave_balance:
            leave_balance.total_days += float(hours / 9)
        else:
            db.add(models.LeaveBalance(
                user_id=current_user.id,
                leave_type=models.LeaveType.COMPENSATORY_OFF,
                total_days=float(hours / 9),
                used_days=0
            ))
            
    if is_holiday:
        record.status = models.AttendanceStatus.PRESENT
        credit_overtime(float(record.total_hours))
    else:
        if record.total_hours < 4:
            record.status = models.AttendanceStatus.ABSENT
        elif record.total_hours < 9:
            record.status = models.AttendanceStatus.PARTIAL
        else:
            record.status = models.AttendanceStatus.PRESENT
            if record.total_hours > 9:
                credit_overtime(float(record.total_hours - 9))
    
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
    return db.query(models.User).all()

@app.get("/api/org/hierarchy")
def get_org_hierarchy(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Get all users
    users = db.query(models.User).all()
    
    # Build a map of users by ID for quick lookup
    user_map = {u.id: {
        "id": u.id,
        "name": u.name,
        "role": u.role,
        "designation": u.designation,
        "department": u.department,
        "avatar": f"https://ui-avatars.com/api/?name={u.name.replace(' ', '+')}&background=random",
        "children": []
    } for u in users}
    
    roots = []
    for u in users:
        node = user_map[u.id]
        if u.manager_id and u.manager_id in user_map:
            user_map[u.manager_id]["children"].append(node)
        else:
            # No manager or manager not in list (root level)
            roots.append(node)
            
    return roots

@app.post("/api/users", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN, models.UserRole.CTO]:
        raise HTTPException(status_code=403, detail="Only admins can create users.")
    
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    emp_id = user.employee_id
    if not emp_id:
        user_count = db.query(models.User).count()
        emp_id = f"CS{str(user_count + 1).zfill(3)}"

    hashed_pwd = get_password_hash(user.password) if user.password else get_password_hash(secrets.token_urlsafe(16))
    token = secrets.token_urlsafe(32)
    db_user = models.User(
        employee_id=emp_id,
        name=user.name,
        email=user.email,
        hashed_password=hashed_pwd,
        department=user.department,
        designation=user.designation,
        role=user.role,
        team_id=user.team_id,
        manager_id=user.manager_id,
        reset_token=token,
        reset_token_expires=datetime.utcnow() + timedelta(hours=72)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Initialize leave balances
    if db_user.role != models.UserRole.SUPER_ADMIN:
        for lt in models.LeaveType:
            if lt != models.LeaveType.WFH and lt != models.LeaveType.COMPENSATORY_OFF:
                balance = models.LeaveBalance(user_id=db_user.id, leave_type=lt, total_days=12, used_days=0)
                db.add(balance)
        db.commit()
        
    reset_url = f"http://localhost:4200/reset-password?token={token}"
    email_utils.send_reset_email(db_user.email, reset_url, db_user.name, is_new_user=True)
    
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.role == models.UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Cannot delete a Super Admin")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@app.post("/api/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.role == models.UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=400, detail="Cannot deactivate a Super Admin")
        
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}

@app.post("/api/teams", response_model=schemas.Team)
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can create teams.")
    db_team = models.Team(**team.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

# Holiday Management (Admin Only)
@app.post("/api/holidays", response_model=schemas.Holiday)
def create_holiday(holiday: schemas.HolidayBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
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
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can manage holidays.")
    db_holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(db_holiday)
    db.commit()
    return {"message": "Holiday deleted"}

# Admin Management (Users)
@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete users.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.put("/api/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_data: schemas.UserBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can update users.")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for key, value in user_data.model_dump(exclude_unset=True).items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can delete teams.")
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
    return {"message": "Team deleted successfully"}

# Leave Balances
@app.get("/api/leave-balances", response_model=List[schemas.LeaveBalance])
def get_leave_balances(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.LeaveBalance).filter(models.LeaveBalance.user_id == current_user.id).all()

@app.get("/api/leave-balances/{user_id}", response_model=List[schemas.LeaveBalance])
def get_user_leave_balances(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN] and current_user.id != target_user.manager_id and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return db.query(models.LeaveBalance).filter(models.LeaveBalance.user_id == user_id).all()

@app.put("/api/leave-balances/{user_id}", response_model=List[schemas.LeaveBalance])
def update_leave_balances(user_id: int, updates: List[schemas.LeaveBalanceUpdate], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN] and current_user.id != target_user.manager_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit leave balances")
        
    for update in updates:
        balance = db.query(models.LeaveBalance).filter(
            models.LeaveBalance.user_id == user_id,
            models.LeaveBalance.leave_type == update.leave_type
        ).first()
        if balance:
            balance.total_days = update.total_days
        else:
            db.add(models.LeaveBalance(
                user_id=user_id,
                leave_type=update.leave_type,
                total_days=update.total_days,
                used_days=0
            ))
            
    db.commit()
    return db.query(models.LeaveBalance).filter(models.LeaveBalance.user_id == user_id).all()

# Notifications
@app.get("/api/notifications", response_model=List[schemas.Notification])
def get_notifications(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Notification).filter(models.Notification.user_id == current_user.id).order_by(models.Notification.created_at.desc()).all()

@app.post("/api/notifications/broadcast")
def broadcast_notification(data: schemas.BroadcastNotification, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.SUPER_ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized to broadcast notifications")
        
    target_users = []
    
    if data.target_type == "ALL":
        target_users = db.query(models.User).all()
    elif data.target_type == "INDIVIDUAL":
        target_users = db.query(models.User).filter(models.User.employee_id == data.target_value).all()
    elif data.target_type == "ROLE":
        try:
            role_enum = models.UserRole(data.target_value)
            target_users = db.query(models.User).filter(models.User.role == role_enum).all()
        except ValueError:
            pass # Invalid role
    elif data.target_type == "TEAM":
        team = db.query(models.Team).filter(models.Team.name == data.target_value).first()
        if team:
            target_users = db.query(models.User).filter(models.User.team_id == team.id).all()
    elif data.target_type == "DEPARTMENT":
        target_users = db.query(models.User).filter(models.User.department == data.target_value).all()
        
    for user in target_users:
        notif = models.Notification(
            user_id=user.id,
            title=data.title,
            message=data.message,
            type=data.type
        )
        db.add(notif)
        
    db.commit()
    return {"message": f"Broadcasted to {len(target_users)} users"}

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

@app.get("/api/manager/pending")
def get_manager_pending(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Get all reportees
    reportees = db.query(models.User).filter(models.User.manager_id == current_user.id).all()
    reportee_ids = [r.id for r in reportees]
    
    if current_user.role == models.UserRole.ADMIN:
        # Admins see everything pending if they want? Or just everything.
        # For now, let's stick to manager logic.
        pass

    pending_leaves = db.query(models.LeaveRequest).filter(
        models.LeaveRequest.user_id.in_(reportee_ids),
        models.LeaveRequest.status == models.LeaveStatus.PENDING
    ).all()
    
    # We need to include the user name for display
    leaves_with_info = []
    for l in pending_leaves:
        u = db.query(models.User).filter(models.User.id == l.user_id).first()
        leaves_with_info.append({
            "id": l.id,
            "userName": u.name,
            "type": l.leave_type,
            "startDate": l.start_date,
            "endDate": l.end_date,
            "reason": l.reason,
            "status": l.status
        })

    pending_reg = db.query(models.Attendance).filter(
        models.Attendance.user_id.in_(reportee_ids),
        models.Attendance.reg_status == models.RegularizationStatus.PENDING
    ).all()
    
    reg_with_info = []
    for r in pending_reg:
        u = db.query(models.User).filter(models.User.id == r.user_id).first()
        reg_with_info.append({
            "id": r.id,
            "userId": r.user_id,
            "userName": u.name,
            "date": r.date,
            "punchIn": r.punch_in,
            "punchOut": r.punch_out,
            "status": r.status,
            "regStatus": r.reg_status.value,
            "reason": r.reason
        })
        
    return {
        "leaves": leaves_with_info,
        "regularizations": reg_with_info
    }

# Regularization Approval
@app.post("/api/attendance/{attendance_id}/approve")
def approve_regularization(attendance_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    record = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Permission check: Manager of the user or Admin
    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if current_user.role != models.UserRole.ADMIN and current_user.id != user.manager_id:
        raise HTTPException(status_code=403, detail="Not authorized to approve this request")
    
    record.reg_status = models.RegularizationStatus.APPROVED
    db.commit()
    
    # Notify user
    notif = models.Notification(
        user_id=record.user_id,
        title="Regularization Approved",
        message=f"Your regularization request for {record.date} has been approved.",
        type="ATTENDANCE"
    )
    db.add(notif)
    
    # Delete manager's notification
    manager_notif = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.message.like(f"%{user.name} requested regularization for {record.date}%")
    ).first()
    if manager_notif:
        db.delete(manager_notif)
        
    db.commit()
    
    return {"message": "Request approved"}

@app.post("/api/attendance/{attendance_id}/reject")
def reject_regularization(attendance_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    record = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    user = db.query(models.User).filter(models.User.id == record.user_id).first()
    if current_user.role != models.UserRole.ADMIN and current_user.id != user.manager_id:
        raise HTTPException(status_code=403, detail="Not authorized to reject this request")
    
    record.reg_status = models.RegularizationStatus.REJECTED
    # If rejected, we might want to revert status to ABSENT
    record.status = models.AttendanceStatus.ABSENT
    db.commit()
    
    # Notify user
    notif = models.Notification(
        user_id=record.user_id,
        title="Regularization Rejected",
        message=f"Your regularization request for {record.date} has been rejected.",
        type="ATTENDANCE"
    )
    db.add(notif)
    
    # Delete manager's notification
    manager_notif = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.message.like(f"%{user.name} requested regularization for {record.date}%")
    ).first()
    if manager_notif:
        db.delete(manager_notif)
        
    db.commit()
    
    return {"message": "Request rejected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)