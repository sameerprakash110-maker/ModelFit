from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.exceptions import EntityNotFoundException
from app.models.benchmark import Benchmark
from app.models.evaluation import Evaluation
from app.models.project import Project
from app.models.test_case import TestCase
from app.services.benchmark_service import BenchmarkService
from app.services.evaluation_service import EvaluationService
from app.services.project_service import ProjectService
from app.services.test_case_service import TestCaseService
from app.utils.logger import logger


class OwnershipService:
    """Enforces persistent database-level multi-user resource ownership and authorization checks.
    
    Hierarchy:
    User -> Project -> Benchmark -> Evaluation -> EvaluationAttempt
    User -> Project -> TestCase
    User -> Project -> Benchmark -> Reports & ROI
    """

    @classmethod
    def reset_store(cls) -> None:
        """Retained for test isolation compatibility."""
        pass

    @classmethod
    def get_project_owner(cls, project: Project) -> Optional[str]:
        """Resolve owner UUID from persistent database column."""
        return project.owner_id

    @classmethod
    def verify_project_access(
        cls,
        db: Session,
        project_id: str,
        user_id: str,
    ) -> Project:
        """Verify that the user owns the specified project via database column.
        Raises 404 if not found or unauthorized to prevent resource enumeration.
        """
        project = ProjectService.get_project_by_id(db, project_id)
        if not project:
            raise EntityNotFoundException("Project", project_id)

        # If project has an assigned owner_id and does not match requester, return 404
        if project.owner_id and project.owner_id != user_id:
            logger.warning(
                f"Unauthorized project access attempt: user {user_id} tried to access project {project_id} owned by {project.owner_id}"
            )
            raise EntityNotFoundException("Project", project_id)

        return project

    @classmethod
    def verify_benchmark_access(
        cls,
        db: Session,
        benchmark_id: str,
        user_id: str,
    ) -> Benchmark:
        """Verify that the user owns the parent project of the benchmark."""
        benchmark = BenchmarkService.get_benchmark_by_id(db, benchmark_id)
        if not benchmark:
            raise EntityNotFoundException("Benchmark", benchmark_id)

        # Cascading check via parent project in database
        cls.verify_project_access(db, benchmark.project_id, user_id)
        return benchmark

    @classmethod
    def verify_test_case_access(
        cls,
        db: Session,
        test_case_id: str,
        user_id: str,
    ) -> TestCase:
        """Verify that the user owns the parent project of the test case."""
        test_case = TestCaseService.get_test_case_by_id(db, test_case_id)
        if not test_case:
            raise EntityNotFoundException("TestCase", test_case_id)

        cls.verify_project_access(db, test_case.project_id, user_id)
        return test_case

    @classmethod
    def verify_evaluation_access(
        cls,
        db: Session,
        evaluation_id: str,
        user_id: str,
    ) -> Evaluation:
        """Verify that the user owns the parent benchmark of the evaluation."""
        eval_record = EvaluationService.get_evaluation_by_id(db, evaluation_id)
        if not eval_record:
            raise EntityNotFoundException("Evaluation", evaluation_id)

        cls.verify_benchmark_access(db, eval_record.benchmark_id, user_id)
        return eval_record

    @classmethod
    def filter_projects_for_user(
        cls,
        projects: List[Project],
        user_id: str,
    ) -> List[Project]:
        """Filter projects for user."""
        return [
            p for p in projects
            if (p.owner_id == user_id or p.owner_id is None)
        ]

    @classmethod
    def filter_benchmarks_for_user(
        cls,
        db: Session,
        benchmarks: List[Benchmark],
        user_id: str,
    ) -> List[Benchmark]:
        """Filter benchmarks so only those belonging to user-owned projects are returned."""
        allowed: List[Benchmark] = []
        for b in benchmarks:
            try:
                cls.verify_project_access(db, b.project_id, user_id)
                allowed.append(b)
            except EntityNotFoundException:
                pass
        return allowed

    @classmethod
    def filter_test_cases_for_user(
        cls,
        db: Session,
        test_cases: List[TestCase],
        user_id: str,
    ) -> List[TestCase]:
        """Filter test cases so only those belonging to user-owned projects are returned."""
        allowed: List[TestCase] = []
        for tc in test_cases:
            try:
                cls.verify_project_access(db, tc.project_id, user_id)
                allowed.append(tc)
            except EntityNotFoundException:
                pass
        return allowed
