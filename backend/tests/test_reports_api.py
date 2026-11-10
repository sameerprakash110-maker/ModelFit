from fastapi.testclient import TestClient


def _setup_api_project_and_test_case(client: TestClient) -> tuple[str, str]:
    proj_res = client.post(
        "/api/v1/projects",
        json={
            "name": "Reporting QA",
            "system_prompt": "You are a customer service assistant.",
            "rubric": {"accuracy": "Must answer precisely"},
        },
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    tc_res = client.post(
        "/api/v1/test-cases",
        json={
            "project_id": project_id,
            "input_prompt": "What are your business hours?",
            "expected_behavior": "Open 9am to 5pm Monday through Friday.",
            "evaluation_criteria": {"completeness": "State hours and days"},
        },
    )
    assert tc_res.status_code == 201
    test_case_id = tc_res.json()["id"]
    return project_id, test_case_id


def test_benchmark_run_and_reporting_lifecycle(client: TestClient):
    """Verify executing benchmark via POST /run and retrieving summary and report endpoints."""
    project_id, test_case_id = _setup_api_project_and_test_case(client)

    # 1. Create benchmark
    create_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Q2 Model Comparison",
            "selected_models": ["gemini-3.1-flash-lite", "gpt-4o"],
            "repeats": 1,
        },
    )
    assert create_res.status_code == 201
    benchmark_id = create_res.json()["id"]

    # 2. Run benchmark in mock mode
    run_res = client.post(
        f"/api/v1/benchmarks/{benchmark_id}/run",
        json={"mock": True, "judge_enabled": True},
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["benchmark_id"] == benchmark_id
    assert run_data["status"] == "completed"
    assert run_data["total_evaluations"] == 2  # 2 models x 1 test case
    assert run_data["successful_evaluations"] == 2
    assert run_data["completed_at"] is not None

    # 3. GET /api/v1/benchmarks/{id}/summary
    sum_res = client.get(f"/api/v1/benchmarks/{benchmark_id}/summary")
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert sum_data["benchmark_id"] == benchmark_id
    assert sum_data["status"] == "completed"
    assert "model_summaries" in sum_data
    assert "gemini-3.1-flash-lite" in sum_data["model_summaries"]
    assert "gpt-4o" in sum_data["model_summaries"]

    # 4. GET /api/v1/reports/benchmark/{id}
    rep_res = client.get(f"/api/v1/reports/benchmark/{benchmark_id}?monthly_volume=50000")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert rep_data["benchmark_id"] == benchmark_id
    assert "overall_reliability" in rep_data
    assert rep_data["overall_reliability"]["success_rate"] == 1.0
    assert "overall_performance" in rep_data
    assert "overall_financial" in rep_data
    assert "overall_quality" in rep_data
    assert "roi_recommendation" in rep_data
    assert rep_data["roi_recommendation"]["monthly_volume"] == 50000

    # 5. GET /api/v1/reports/roi/{id}
    roi_res = client.get(f"/api/v1/reports/roi/{benchmark_id}?monthly_volume=200000&target_category=lowest_cost")
    assert roi_res.status_code == 200
    roi_data = roi_res.json()
    assert roi_data["benchmark_id"] == benchmark_id
    assert roi_data["monthly_volume"] == 200000
    assert roi_data["recommendation"]["category"] == "lowest_cost"
    assert roi_data["recommendation"]["recommended_primary_model"] is not None


def test_get_evaluation_detail_with_attempts_api(client: TestClient):
    """Verify GET /api/v1/evaluations/{id} returns full attempt breakdown."""
    project_id, test_case_id = _setup_api_project_and_test_case(client)

    bench_res = client.post(
        "/api/v1/benchmarks",
        json={
            "project_id": project_id,
            "name": "Attempt Inspection Benchmark",
            "selected_models": ["gemini-3.1-flash-lite"],
            "repeats": 1,
        },
    )
    benchmark_id = bench_res.json()["id"]

    # Run in mock mode
    run_res = client.post(f"/api/v1/benchmarks/{benchmark_id}/run", json={"mock": True})
    assert run_res.status_code == 200

    # Fetch list of evaluations
    evals_res = client.get(f"/api/v1/evaluations/benchmark/{benchmark_id}")
    assert evals_res.status_code == 200
    eval_list = evals_res.json()
    assert len(eval_list) >= 1
    eval_id = eval_list[0]["id"]

    # Fetch evaluation detail with attempts
    detail_res = client.get(f"/api/v1/evaluations/{eval_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == eval_id
    assert "attempts" in detail_data
    assert len(detail_data["attempts"]) >= 1
    assert detail_data["attempts"][0]["attempt_number"] == 1


def test_nonexistent_benchmark_reports_404(client: TestClient):
    """Verify 404 error returned for non-existent benchmark across report endpoints."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/api/v1/benchmarks/{fake_id}/summary").status_code == 404
    assert client.get(f"/api/v1/reports/benchmark/{fake_id}").status_code == 404
    assert client.get(f"/api/v1/reports/roi/{fake_id}").status_code == 404
