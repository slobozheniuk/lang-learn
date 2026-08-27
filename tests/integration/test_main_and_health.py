from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Language Learning App" in data["app"]


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        data = response.json()
        assert "Language Learning App" in data.get("message", "")
    else:
        assert "<html" in response.text.lower() or "doctype" in response.text.lower()

