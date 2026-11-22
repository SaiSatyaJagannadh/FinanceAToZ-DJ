"""Check that DataAPIClient.execute waits out Aurora's auto-pause resume. Run: uv run test_resume_retry.py"""
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError
from src.client import DataAPIClient

resuming = ClientError({"Error": {"Code": "DatabaseResumingException", "Message": "resuming"}}, "ExecuteStatement")
other = ClientError({"Error": {"Code": "BadRequestException", "Message": "bad sql"}}, "ExecuteStatement")

db = DataAPIClient(cluster_arn="arn:x", secret_arn="arn:y")
with patch("src.client.time.sleep"):
    db.client = MagicMock(execute_statement=MagicMock(side_effect=[resuming, resuming, {"ok": 1}]))
    assert db.execute("SELECT 1") == {"ok": 1} and db.client.execute_statement.call_count == 3

    db.client = MagicMock(execute_statement=MagicMock(side_effect=other))
    try:
        db.execute("SELECT 1"); raise AssertionError("should raise")
    except ClientError:
        assert db.client.execute_statement.call_count == 1  # real errors are not retried

    db.client = MagicMock(execute_statement=MagicMock(side_effect=resuming))
    try:
        db.execute("SELECT 1"); raise AssertionError("should raise")
    except ClientError:
        assert db.client.execute_statement.call_count == 8  # gives up after ~24s
print("✅ resume retry works")
