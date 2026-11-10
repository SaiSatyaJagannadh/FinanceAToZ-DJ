# /// script
# dependencies = ["boto3", "psycopg[binary]"]
# ///
"""One-off for the AWS Free plan: an Aurora express cluster only allows IAM login,
but the Data API needs a password user. Log in as postgres with an IAM token, then
create the alexadmin login (password from the Terraform-managed secret) and the alex database."""
import json

import boto3
import psycopg
from psycopg import sql

REGION = "us-east-1"
CLUSTER = "alex-aurora-cluster"

rds = boto3.client("rds", region_name=REGION)
host = rds.describe_db_clusters(DBClusterIdentifier=CLUSTER)["DBClusters"][0]["Endpoint"]
token = rds.generate_db_auth_token(DBHostname=host, Port=5432, DBUsername="postgres", Region=REGION)

sm = boto3.client("secretsmanager", region_name=REGION)
secrets = sm.list_secrets(Filters=[{"Key": "name", "Values": ["alex-aurora-credentials-"]}])["SecretList"]
assert len(secrets) == 1, f"expected one alex-aurora-credentials secret, found {len(secrets)}"
arn = secrets[0]["ARN"]
creds = json.loads(sm.get_secret_value(SecretId=arn)["SecretString"])
user = sql.Identifier(creds["username"])

with psycopg.connect(host=host, port=5432, user="postgres", password=token,
                     dbname="postgres", sslmode="require", autocommit=True) as conn:
    exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (creds["username"],)).fetchone()
    verb = "ALTER" if exists else "CREATE"
    conn.execute(sql.SQL(verb + " ROLE {} WITH LOGIN PASSWORD {}").format(user, sql.Literal(creds["password"])))
    conn.execute(sql.SQL("GRANT rds_superuser TO {}").format(user))  # schema needs CREATE EXTENSION
    conn.execute(sql.SQL("GRANT {} TO postgres").format(user))  # PG16+: CREATE DATABASE ... OWNER needs SET ROLE
    if not conn.execute("SELECT 1 FROM pg_database WHERE datname = 'alex'").fetchone():
        conn.execute(sql.SQL("CREATE DATABASE alex OWNER {}").format(user))

print(f"✅ {'Updated' if exists else 'Created'} role {creds['username']} (rds_superuser) and database alex on {host}")
