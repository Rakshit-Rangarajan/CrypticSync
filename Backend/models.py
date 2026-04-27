from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Date, Enum, Text, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum
from database import Base

class UserRole(enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    TEAM_LEAD = "TEAM_LEAD"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"
    CTO = "CTO"
    SUPER_ADMIN = "SUPER_ADMIN"

class RegularizationStatus(enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class AttendanceStatus(enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    PARTIAL = "PARTIAL"
    HOLIDAY = "HOLIDAY"
    LEAVE = "LEAVE"
    INCOMPLETE = "INCOMPLETE"
    NOT_RECORDED = "NOT_RECORDED"
    WFH = "WFH"

class LeaveType(enum.Enum):
    SICK_LEAVE = "SICK_LEAVE"
    PAID_LEAVE = "PAID_LEAVE"
    PERSONAL_LEAVE = "PERSONAL_LEAVE"
    CASUAL_LEAVE = "CASUAL_LEAVE"
    EMERGENCY_LEAVE = "EMERGENCY_LEAVE"
    MATERNITY_LEAVE = "MATERNITY_LEAVE"
    PATERNITY_LEAVE = "PATERNITY_LEAVE"
    COMPENSATORY_OFF = "COMPENSATORY_OFF"
    WFH = "WFH"

class LeaveStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(String(20), unique=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(50))
    designation = Column(String(50))
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    manager = relationship("User", remote_side=[id], backref="subordinates")
    attendance_records = relationship("Attendance", back_populates="user")
    leave_requests = relationship("LeaveRequest", foreign_keys="LeaveRequest.user_id", back_populates="user")
    approved_leaves = relationship("LeaveRequest", foreign_keys="LeaveRequest.approver_id", back_populates="approver")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    department = Column(String(100), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    manager = relationship("User", foreign_keys=[manager_id])
    members = relationship("User", foreign_keys="User.team_id")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    punch_in = Column(DateTime, nullable=True)
    punch_out = Column(DateTime, nullable=True)
    total_hours = Column(Numeric(5, 2))
    status = Column(Enum(AttendanceStatus))
    reg_status = Column(Enum(RegularizationStatus), default=RegularizationStatus.NONE)
    reason = Column(Text, nullable=True)
    last_action_time = Column(DateTime, nullable=True)
    total_worked_seconds = Column(Integer, default=0)
    is_paused = Column(Boolean, default=False)
    overtime_hours = Column(Numeric(5, 2), default=0)

    user = relationship("User", back_populates="attendance_records")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    leave_type = Column(Enum(LeaveType))
    duration = Column(String(20), default="FULL_DAY") # FULL_DAY, HALF_DAY_MORNING, HALF_DAY_EVENING
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="leave_requests")
    approver = relationship("User", foreign_keys=[approver_id], back_populates="approved_leaves")

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, unique=True)
    holiday_name = Column(String(100))
    description = Column(Text, nullable=True)
    is_optional = Column(Boolean, default=False)

class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    leave_type = Column(Enum(LeaveType))
    total_days = Column(Integer, default=0)
    used_days = Column(Integer, default=0)
    
    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    type = Column(String)  # info, success, warning, error
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    user = relationship("User", back_populates="notifications")

User.notifications = relationship("Notification", back_populates="user")