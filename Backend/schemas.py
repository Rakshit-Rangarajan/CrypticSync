from pydantic import BaseModel, ConfigDict, EmailStr, Field
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
    team_id: Optional[int] = None
    manager_id: Optional[int] = None
    is_active: bool = True
    joining_date: date = date.today()

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    team_name: Optional[str] = None
    manager_name: Optional[str] = None

class UserWithTeam(BaseSchema):
    id: int
    employee_id: str
    name: str
    email: EmailStr
    department: Optional[str] = None
    designation: Optional[str] = None
    role: UserRole
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    is_active: bool = True
    joining_date: date = date.today()

class TeamBase(BaseSchema):
    name: str
    department: str
    manager_id: Optional[int] = None

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    id: int
    member_count: Optional[int] = 0

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
    total_worked_seconds: int = 0
    is_paused: bool = False
    last_action_time: Optional[datetime] = None
    status: AttendanceStatus

class AttendanceCreate(AttendanceBase):
    user_id: int

class Attendance(AttendanceBase):
    id: int
    user_id: int

class LeaveRequestBase(BaseSchema):
    start_date: date
    end_date: date
    leave_type: LeaveType
    reason: Optional[str] = None

class LeaveRequestCreate(LeaveRequestBase):
    user_id: int

class LeaveRequest(LeaveRequestBase):
    id: int
    user_id: int
    status: LeaveStatus = LeaveStatus.PENDING
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    created_at: Optional[datetime] = None

class HolidayBase(BaseSchema):
    date: date
    holiday_name: str
    description: Optional[str] = None
    is_optional: bool = False

class Holiday(HolidayBase):
    id: int

class LeaveBalanceBase(BaseSchema):
    leave_type: LeaveType
    total_days: int
    used_days: int

class LeaveBalance(LeaveBalanceBase):
    id: int
    user_id: int

class ReporteeWithAttendance(BaseSchema):
    user: User
    attendance: List[Attendance] = []

class UserStats(BaseSchema):
    total_present: int = 0
    total_absent: int = 0
    total_incomplete: int = 0
    pending_leaves: int = 0

class NotificationBase(BaseSchema):
    title: str
    message: str
    type: str
    is_read: bool = False
    created_at: Optional[datetime] = None

class Notification(NotificationBase):
    id: int
    user_id: int