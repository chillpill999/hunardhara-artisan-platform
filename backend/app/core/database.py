import json
import logging
from typing import Generator
from sqlalchemy import create_engine, TypeDecorator, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Base Declarative Class
Base = declarative_base()


class PortableVector(TypeDecorator):
    """
    SQLAlchemy type decorator that uses pgvector.sqlalchemy.Vector when connected
    to PostgreSQL with the pgvector extension, and falls back to JSON / Text on SQLite.
    Stores and retrieves Python list of floats.
    """
    impl = JSON
    cache_ok = True

    def __init__(self, dim: int = 768, *args, **kwargs):
        self.dim = dim
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(self.dim))
            except ImportError:
                return dialect.type_descriptor(JSON())
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            if dialect.name == "postgresql":
                try:
                    import numpy as np
                    return np.array(value, dtype=np.float32)
                except ImportError:
                    return list(value)
            return list(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return [float(x.strip()) for x in value.strip("[]()").split(",") if x.strip()]
        if hasattr(value, "tolist"):
            return value.tolist()
        return list(value)


# Sync Database Engine Configuration
db_url = settings.sync_db_url
connect_args = {}
engine_kwargs = {"echo": False}

if "sqlite" in db_url:
    connect_args["check_same_thread"] = False
else:
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
    })

try:
    engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)
except Exception as e:
    logger.warning(f"Could not create engine for {db_url}: {e}. Falling back to SQLite.")
    sqlite_url = "sqlite:///./artisan_platform.db"
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session and closes it after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initializes all database tables defined in the models.
    """
    # Import all models to ensure they are registered with Base.metadata
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")
