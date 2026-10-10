from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    greenhouses = relationship("Greenhouse", back_populates="owner", cascade="all, delete-orphan")


class Greenhouse(Base):
    __tablename__ = "greenhouses"
    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String(120), nullable=False)
    crop = Column(String(80), default="Fraise")
    variety = Column(String(80), nullable=True)
    location = Column(String(180), nullable=True)
    photo_url = Column(String(500), nullable=True)
    device_key = Column(String(120), unique=True, index=True, nullable=False)
    automatic_mode = Column(Boolean, default=True)
    owner = relationship("User", back_populates="greenhouses")
    measurements = relationship("Measurement", cascade="all, delete-orphan")


class Measurement(Base):
    __tablename__ = "measurements"
    id = Column(Integer, primary_key=True)
    greenhouse_id = Column(Integer, ForeignKey("greenhouses.id"), index=True, nullable=False)
    air_temperature = Column(Float, nullable=False)
    air_humidity = Column(Float, nullable=False)
    soil_moisture = Column(Float, nullable=False)
    luminosity = Column(Float, nullable=False)
    co2 = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    water_level = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class ActuatorState(Base):
    __tablename__ = "actuator_states"
    id = Column(Integer, primary_key=True)
    greenhouse_id = Column(Integer, ForeignKey("greenhouses.id"), unique=True, index=True, nullable=False)
    pump = Column(Boolean, default=False)
    fan = Column(Boolean, default=False)
    mister = Column(Boolean, default=False)
    grow_light = Column(Boolean, default=False)
    buzzer = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True)
    greenhouse_id = Column(Integer, ForeignKey("greenhouses.id"), index=True, nullable=False)
    level = Column(String(20), default="attention")
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Threshold(Base):
    __tablename__ = "thresholds"
    id = Column(Integer, primary_key=True)
    greenhouse_id = Column(Integer, ForeignKey("greenhouses.id"), unique=True, nullable=False)
    max_temperature = Column(Float, default=28)
    min_air_humidity = Column(Float, default=60)
    min_soil_moisture = Column(Float, default=50)
    min_luminosity = Column(Float, default=500)
    max_co2 = Column(Float, default=1000)
    min_water_level = Column(Float, default=25)
