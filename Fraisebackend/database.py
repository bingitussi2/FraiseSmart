"""Connexion SQLAlchemy commune au mode local et à la production PostgreSQL."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./database.db")
    # Certains hébergeurs exposent encore l'ancien préfixe Heroku.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


SQLALCHEMY_DATABASE_URL = database_url()
engine_options = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
