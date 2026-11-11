from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    benchmarks,
    evaluations,
    health,
    projects,
    providers,
    reports,
    test_cases,
)

v1_router = APIRouter()

v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
v1_router.include_router(health.router, prefix="/health", tags=["Health"])
v1_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
v1_router.include_router(providers.router, prefix="/providers", tags=["Providers"])
v1_router.include_router(benchmarks.router, prefix="/benchmarks", tags=["Benchmarks"])
v1_router.include_router(test_cases.router, prefix="/test-cases", tags=["Test Cases"])
v1_router.include_router(evaluations.router, prefix="/evaluations", tags=["Evaluations"])
v1_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
