import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from dotenv import load_dotenv
load_dotenv()
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import models, schemas
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)
SECRET = os.getenv("JWT_SECRET", "change-this-secret-before-production")
ALGORITHM = "HS256"

app = FastAPI(title="KivuSense API", version="1.0.0", description="Plateforme IoT sécurisée de surveillance et de régulation climatique des serres agricoles à Goma.")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])

def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 310_000).hex()
    return f"{salt}${digest}"

def verify_password(password: str, stored: str) -> bool:
    salt, _ = stored.split("$", 1)
    return secrets.compare_digest(hash_password(password, salt), stored)

def token_for(user_id: int) -> str:
    return jwt.encode({"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}, SECRET, algorithm=ALGORITHM)

def current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> models.User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Jeton manquant")
    try: user_id = int(jwt.decode(authorization[7:], SECRET, algorithms=[ALGORITHM])["sub"])
    except (JWTError, KeyError, ValueError): raise HTTPException(status_code=401, detail="Jeton invalide")
    user = db.get(models.User, user_id)
    if not user: raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user

def owned_greenhouse(greenhouse_id: int, user: models.User, db: Session) -> models.Greenhouse:
    obj = db.query(models.Greenhouse).filter_by(id=greenhouse_id, owner_id=user.id).first()
    if not obj: raise HTTPException(status_code=404, detail="Serre introuvable")
    return obj

def create_alerts(db: Session, greenhouse_id: int, m: schemas.MeasurementCreate):
    t = db.query(models.Threshold).filter_by(greenhouse_id=greenhouse_id).first()
    if not t: return
    rules = [
        (m.air_temperature > t.max_temperature, "danger", "Température élevée", f"Température mesurée : {m.air_temperature:.1f} °C."),
        (m.soil_moisture < t.min_soil_moisture, "attention", "Humidité du sol faible", f"Humidité mesurée : {m.soil_moisture:.0f} %."),
        (m.water_level is not None and m.water_level < t.min_water_level, "danger", "Réservoir presque vide", f"Niveau mesuré : {m.water_level:.0f} %."),
        (m.co2 is not None and m.co2 > t.max_co2, "danger", "CO₂ trop élevé", f"Concentration mesurée : {m.co2:.0f} ppm."),
    ]
    for triggered, level, title, message in rules:
        if triggered: db.add(models.Alert(greenhouse_id=greenhouse_id, level=level, title=title, message=message))

@app.get("/")
def root(): return {"name": "KivuSense API", "status": "online", "docs": "/docs"}

@app.post("/auth/register", response_model=schemas.Token, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(models.User).filter_by(email=email).first(): raise HTTPException(409, "Cette adresse e-mail est déjà utilisée")
    user = models.User(full_name=payload.full_name.strip(), email=email, phone=payload.phone, password_hash=hash_password(payload.password))
    db.add(user); db.commit(); db.refresh(user)
    return schemas.Token(access_token=token_for(user.id), user=user)

@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.Login, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(email=payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(401, "E-mail ou mot de passe incorrect")
    return schemas.Token(access_token=token_for(user.id), user=user)

@app.get("/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)): return user

@app.put("/auth/me", response_model=schemas.UserOut)
def update_profile(payload: schemas.UserUpdate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    email = payload.email.lower()
    duplicate = db.query(models.User).filter(models.User.email == email, models.User.id != user.id).first()
    if duplicate: raise HTTPException(409, "Cette adresse e-mail est déjà utilisée")
    user.full_name = payload.full_name.strip(); user.email = email; user.phone = payload.phone
    db.commit(); db.refresh(user); return user

@app.put("/auth/password", status_code=204)
def change_password(payload: schemas.PasswordChange, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.password_hash): raise HTTPException(400, "Mot de passe actuel incorrect")
    user.password_hash = hash_password(payload.new_password); db.commit()

@app.get("/greenhouses", response_model=List[schemas.GreenhouseOut])
def greenhouses(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(models.Greenhouse).filter_by(owner_id=user.id).all()

@app.post("/greenhouses", response_model=schemas.GreenhouseProvisioning, status_code=201)
def create_greenhouse(payload: schemas.GreenhouseCreate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    obj = models.Greenhouse(**payload.model_dump(), owner_id=user.id, device_key=secrets.token_urlsafe(24))
    db.add(obj); db.flush(); db.add(models.Threshold(greenhouse_id=obj.id)); db.add(models.ActuatorState(greenhouse_id=obj.id)); db.commit(); db.refresh(obj); return obj

@app.put("/greenhouses/{greenhouse_id}", response_model=schemas.GreenhouseOut)
def update_greenhouse(greenhouse_id: int, payload: schemas.GreenhouseUpdate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    obj = owned_greenhouse(greenhouse_id, user, db)
    for key, value in payload.model_dump().items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

@app.get("/greenhouses/{greenhouse_id}/provisioning", response_model=schemas.GreenhouseProvisioning)
def provisioning(greenhouse_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    return owned_greenhouse(greenhouse_id, user, db)

@app.patch("/greenhouses/{greenhouse_id}/mode", response_model=schemas.GreenhouseOut)
def update_mode(greenhouse_id: int, payload: schemas.GreenhouseMode, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    obj = owned_greenhouse(greenhouse_id, user, db)
    obj.automatic_mode = payload.automatic_mode
    db.commit(); db.refresh(obj); return obj

@app.post("/iot/measurements", response_model=schemas.MeasurementOut, status_code=201)
def ingest(payload: schemas.MeasurementCreate, x_device_key: str = Header(...), db: Session = Depends(get_db)):
    greenhouse = db.query(models.Greenhouse).filter_by(device_key=x_device_key).first()
    if not greenhouse: raise HTTPException(401, "Clé appareil invalide")
    obj = models.Measurement(**payload.model_dump(), greenhouse_id=greenhouse.id); db.add(obj); create_alerts(db, greenhouse.id, payload); db.commit(); db.refresh(obj); return obj

@app.get("/greenhouses/{greenhouse_id}/measurements/latest", response_model=schemas.MeasurementOut)
def latest(greenhouse_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); obj = db.query(models.Measurement).filter_by(greenhouse_id=greenhouse_id).order_by(models.Measurement.recorded_at.desc()).first()
    if not obj: raise HTTPException(404, "Aucune mesure disponible")
    return obj

@app.get("/greenhouses/{greenhouse_id}/measurements", response_model=List[schemas.MeasurementOut])
def measurement_history(greenhouse_id: int, limit: int = Query(100, ge=1, le=1000), user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); return db.query(models.Measurement).filter_by(greenhouse_id=greenhouse_id).order_by(models.Measurement.recorded_at.desc()).limit(limit).all()

@app.get("/greenhouses/{greenhouse_id}/alerts", response_model=List[schemas.AlertOut])
def alerts(greenhouse_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); return db.query(models.Alert).filter_by(greenhouse_id=greenhouse_id).order_by(models.Alert.created_at.desc()).all()

@app.patch("/greenhouses/{greenhouse_id}/alerts/{alert_id}/resolve", response_model=schemas.AlertOut)
def resolve(greenhouse_id: int, alert_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); obj = db.query(models.Alert).filter_by(id=alert_id, greenhouse_id=greenhouse_id).first()
    if not obj: raise HTTPException(404, "Alerte introuvable")
    obj.resolved = True; db.commit(); db.refresh(obj); return obj

@app.get("/greenhouses/{greenhouse_id}/actuators", response_model=schemas.ActuatorOut)
def actuator_state(greenhouse_id: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); return db.query(models.ActuatorState).filter_by(greenhouse_id=greenhouse_id).first()

@app.put("/greenhouses/{greenhouse_id}/actuators", response_model=schemas.ActuatorOut)
def actuators(greenhouse_id: int, payload: schemas.ActuatorCommand, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    greenhouse = owned_greenhouse(greenhouse_id, user, db)
    if greenhouse.automatic_mode: raise HTTPException(409, "Désactivez le mode automatique avant une commande manuelle")
    obj = db.query(models.ActuatorState).filter_by(greenhouse_id=greenhouse_id).first()
    for key, value in payload.model_dump().items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj

@app.put("/greenhouses/{greenhouse_id}/thresholds", response_model=schemas.ThresholdOut)
def thresholds(greenhouse_id: int, payload: schemas.ThresholdUpdate, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    owned_greenhouse(greenhouse_id, user, db); obj = db.query(models.Threshold).filter_by(greenhouse_id=greenhouse_id).first()
    for key, value in payload.model_dump().items(): setattr(obj, key, value)
    db.commit(); db.refresh(obj); return obj
