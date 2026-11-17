from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.db import database_is_up

router = APIRouter()


@router.get("/health")
async def health(db_up: bool = Depends(database_is_up)) -> JSONResponse:
    if db_up:
        return JSONResponse({"status": "ok", "database": "ok"})
    return JSONResponse({"status": "degraded", "database": "unreachable"}, status_code=503)
