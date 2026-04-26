from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    department = Column(String)
    email = Column(String, unique=True)
    attendance = relationship("AttendanceRecord", back_populates="employee")

class AttendanceRecord(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    date = Column(String) # YYYY-MM-DD
    status = Column(String) # Present, Absent, Late
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    
    employee = relationship("Employee", back_populates="attendance")
