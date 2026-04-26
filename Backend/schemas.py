from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Optional, List

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True
    )

class EmployeeBase(BaseSchema):
    name: str
    department: str
    email: str

class EmployeeCreate(EmployeeBase):
    pass

class AttendanceRecordBase(BaseSchema):
    date: str
    status: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None

class AttendanceRecord(AttendanceRecordBase):
    id: int
    employee_id: int

class Employee(EmployeeBase):
    id: int
    attendance: List[AttendanceRecord] = []
