# crud.py

from sqlalchemy.orm import Session
from . import models, schemas

def get_latest_sensor_data(db: Session):
    return db.query(models.SensorDataDB).order_by(models.SensorDataDB.timestamp.desc()).first()

def create_sensor_data(db: Session, sensor_data: schemas.SensorDataCreate):
    db_sensor_data = models.SensorDataDB(**sensor_data.dict())
    db.add(db_sensor_data)
    db.commit()
    db.refresh(db_sensor_data)
    return db_sensor_data

def get_control_state(db: Session):
    # Nous n'aurons qu'un seul enregistrement pour l'état des contrôles
    return db.query(models.ControlStateDB).first()

def update_control_state(db: Session, control_command: schemas.ControlCommand):
    db_control_state = db.query(models.ControlStateDB).first()
    if db_control_state:
        for key, value in control_command.dict().items():
            setattr(db_control_state, key, value)
        db.commit()
        db.refresh(db_control_state)
    else:
        # Si aucun enregistrement n'existe, en créer un
        db_control_state = models.ControlStateDB(**control_command.dict())
        db.add(db_control_state)
        db.commit()
        db.refresh(db_control_state)
    return db_control_state