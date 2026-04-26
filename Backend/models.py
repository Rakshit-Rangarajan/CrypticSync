from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Date, Enum, Text, Numeric
from sqlalchemy.orm import relationship
import enum
from database import Base

class UserRole(enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"

class AttendanceStatus(enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    PARTIAL = "PARTIAL"
    HOLIDAY = "HOLIDAY"

class LeaveType(enum.Enum):
    PTO = "PTO"
    SICK = "SICK"

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
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=False)

    # Relationships
    manager = relationship("User", remote_side=[id], backref="subordinates")
    attendance_records = relationship("Attendance", back_populates="user")
    leave_requests = relationship("LeaveRequest", foreign_keys="LeaveRequest.user_id", back_populates="user")
    approved_leaves = relationship("LeaveRequest", foreign_keys="LeaveRequest.approver_id", back_populates="approver")

class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date)
    punch_in = Column(DateTime, nullable=True)
    punch_out = Column(DateTime, nullable=True)
    total_hours = Column(Numeric(5, 2))
    status = Column(Enum(AttendanceStatus))

    user = relationship("User", back_populates="attendance_records")

class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    type = Column(Enum(LeaveType))
    status = Column(Enum(LeaveStatus), default=LeaveStatus.PENDING)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="leave_requests")
    approver = relationship("User", foreign_keys=[approver_id], back_populates="approved_leaves")

class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, unique=True)
    holiday_name = Column(String(100))
