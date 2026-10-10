from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=8)

class UserOut(ORMModel):
    id: int; full_name: str; email: EmailStr; phone: Optional[str]

class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class Login(BaseModel):
    email: EmailStr; password: str

class Token(BaseModel):
    access_token: str; token_type: str = "bearer"; user: UserOut

class GreenhouseCreate(BaseModel):
    name: str; crop: str = "Fraise"; variety: Optional[str] = None
    location: Optional[str] = None; photo_url: Optional[str] = None

class GreenhouseUpdate(GreenhouseCreate):
    pass

class GreenhouseOut(ORMModel):
    id: int; name: str; crop: str; variety: Optional[str]; location: Optional[str]
    photo_url: Optional[str]; automatic_mode: bool

class GreenhouseProvisioning(GreenhouseOut):
    device_key: str

class GreenhouseMode(BaseModel):
    automatic_mode: bool

class MeasurementCreate(BaseModel):
    air_temperature: float; air_humidity: float; soil_moisture: float; luminosity: float
    co2: Optional[float] = None; pressure: Optional[float] = None; water_level: Optional[float] = None

class MeasurementOut(MeasurementCreate, ORMModel):
    id: int; greenhouse_id: int; recorded_at: datetime

class ActuatorCommand(BaseModel):
    pump: bool; fan: bool; mister: bool; grow_light: bool; buzzer: bool

class ActuatorOut(ActuatorCommand, ORMModel):
    greenhouse_id: int; updated_at: datetime

class AlertOut(ORMModel):
    id: int; greenhouse_id: int; level: str; title: str; message: str
    resolved: bool; created_at: datetime

class ThresholdUpdate(BaseModel):
    max_temperature: float = 28; min_air_humidity: float = 60
    min_soil_moisture: float = 50; min_luminosity: float = 500
    max_co2: float = 1000; min_water_level: float = 25

class ThresholdOut(ThresholdUpdate, ORMModel):
    greenhouse_id: int
