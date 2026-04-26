from pydantic import BaseModel, ConfigDict, EmailStr
from pydantic.alias_generators import to_camel
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from models import UserRole, AttendanceStatus, LeaveType, LeaveStatus

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True
    )

class UserBase(BaseSchema):
    employee_id: str
    name: str
    email: EmailStr
    department: Optional[str] = None
    designation: Optional[str] = None
    role: UserRole = UserRole.EMPLOYEE
    manager_id: Optional[int] = None
    is_active: bool = False

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int

class Token(BaseSchema):
    access_token: str
    token_type: str

class TokenData(BaseSchema):
    username: Optional[str] = None

class AttendanceBase(BaseSchema):
    date: date
    punch_in: Optional[datetime] = None
    punch_out: Optional[datetime] = None
    total_hours: Optional[Decimal] = None
    status: AttendanceStatus

class AttendanceCreate(AttendanceBase):
    user_id: int

class Attendance(AttendanceBase):
    id: int
    user_id: int

class LeaveRequestBase(BaseSchema):
    start_date: date
    end_date: date
    type: LeaveType
    status: LeaveStatus = LeaveStatus.PENDING
    notes: Optional[str] = None

class LeaveRequestCreate(LeaveRequestBase):
    user_id: int

class LeaveRequest(LeaveRequestBase):
    id: int
    user_id: int
    approver_id: Optional[int] = None

class HolidayBase(BaseSchema):
    date: date
    holiday_name: str

class Holiday(HolidayBase):
    id: int
