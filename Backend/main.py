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

@app.get("/api/leave-balances", response_model=List[schemas.LeaveBalance])
def get_leave_balances(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.LeaveBalance).filter(models.LeaveBalance.user_id == current_user.id).all()