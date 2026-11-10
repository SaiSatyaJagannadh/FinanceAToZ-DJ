# Alex Project — Knowledge Article (Guides 1–5)

Running log of what has been deployed, the workflow followed, and every problem hit along the way with its root cause and fix.

_Last updated: 2026-11-10_

---

## Status at a glance

| Guide | What it deploys | Status |
|---|---|---|
| 1 — Permissions | IAM user `AIEngineer`, AWS CLI configured | ✅ Done |
| 2 — SageMaker | Serverless embedding endpoint `alex-embedding-endpoint` (all-MiniLM-L6-v2) | ✅ Done, `InService`, tested |
| 3 — Ingestion | S3 Vectors bucket, ingest Lambda, API Gateway + API key | ✅ Deployed, API test returns HTTP 200 |
| 4 — Researcher | Researcher agent (Lambda + function URL; guide still says App Runner) | ✅ Deployed, `/health` OK |
| 5 — Database | Aurora Serverless v2 **express** cluster (Free plan), Data API | ✅ Created, migrations run |

## Environment

- **Machine:** macOS, zsh
- **Region:** `us-east-1` everywhere. These must all agree:
  - `.env` → `DEFAULT_AWS_REGION=us-east-1`
  - AWS CLI default → `aws configure get region` prints `us-east-1`
  - each `terraform/*/terraform.tfvars` → `aws_region = "us-east-1"`
- **Bedrock region:** `.env` → `BEDROCK_REGION=us-west-2` (for Guide 4 onwards)
- **`.env` values set so far:** `SAGEMAKER_ENDPOINT`, `VECTOR_BUCKET`, `ALEX_API_ENDPOINT`, `ALEX_API_KEY`

---

## Workflow followed

### Guide 2 — SageMaker

```bash
cd terraform/2_sagemaker
cp terraform.tfvars.example terraform.tfvars   # set aws_region
terraform init
terraform apply
terraform output                               # endpoint name → .env SAGEMAKER_ENDPOINT

cd ../../backend
aws sagemaker-runtime invoke-endpoint --endpoint-name alex-embedding-endpoint \
  --content-type application/json --body fileb://vectorize_me.json --output json output.json
```

A working endpoint returns a JSON array of 384 numbers (the embedding of "vectorize me").

Verification commands:

```bash
aws sagemaker describe-endpoint --endpoint-name alex-embedding-endpoint --query EndpointStatus --output text   # InService
aws sagemaker describe-model --model-name alex-embedding-model --query 'PrimaryContainer.Environment'
# {"HF_MODEL_ID": "sentence-transformers/all-MiniLM-L6-v2", "HF_TASK": "feature-extraction"}
aws logs tail /aws/sagemaker/Endpoints/alex-embedding-endpoint --since 1d
```

### Guide 3 — Ingestion

```bash
cd backend/ingest
uv run package.py                              # builds lambda_function.zip

cd ../../terraform/3_ingestion
cp terraform.tfvars.example terraform.tfvars   # aws_region = "us-east-1"
terraform init
terraform apply
terraform output                               # VECTOR_BUCKET, ALEX_API_ENDPOINT, api_key_id

aws apigateway get-api-key --api-key <api_key_id> --include-value --query value --output text
# → put into .env as ALEX_API_KEY
```

Test the API from the project root (load `.env` into the shell first):

```bash
set -a; source .env; set +a
curl -X POST $ALEX_API_ENDPOINT \
  -H "x-api-key: $ALEX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test document via API", "metadata": {"source": "api_test"}}'
# {"message": "Document indexed successfully", "document_id": "..."}
```

---

## Problems hit and how they were fixed

### 1. `terraform apply` fails: cross-region ECR image pull (Guide 2)

**Error**
```
ValidationException: Region of "763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:..."
does not match expected region of us-east-2. Cross region ECR image pulls are not allowed.
```

**Root cause:** `terraform/2_sagemaker/variables.tf` hardcodes the HuggingFace container image to the **us-east-1** ECR registry. The deployment region was us-east-2, and SageMaker can only pull images from its own region.

**Fix (either):**
- Stay in another region: set `sagemaker_image_uri` in `terraform.tfvars` to the same image in that region, e.g. `763104351884.dkr.ecr.us-east-2.amazonaws.com/huggingface-pytorch-inference:1.13.1-transformers4.26.0-cpu-py39-ubuntu20.04`.
- Or use us-east-1, where the default works. **This is what was chosen.**

### 2. Switching region safely (us-east-2 → us-east-1)

Changing `aws_region` in a directory that is already applied would make Terraform create new resources in the new region and **forget the old ones while they keep running**. Correct order:

1. `terraform destroy` while tfvars still points at the old region
2. Change `aws_region` in `terraform.tfvars` and `DEFAULT_AWS_REGION` in `.env`
3. `terraform apply`
4. Confirm the old region is empty: `aws sagemaker list-endpoints --region us-east-2`

### 3. `invoke-endpoint`: "Endpoint alex-embedding-endpoint ... not found"

**Root cause:** The AWS CLI default region was still `us-east-2`. Guide commands don't pass `--region`, so they looked in the wrong region.

**Fix:** `aws configure set region us-east-1`

### 4. Terminal "stuck" on AWS CLI commands

- **`:` at the bottom of output** is the CLI pager (`less`), not an error. Press `q` to quit or space to scroll. Disable permanently with `aws configure set cli_pager ""`.
- **`aws logs tail ... --follow`** streams forever by design. Press `Ctrl+C`. Use `--since 1d` instead of `--follow` to print recent logs and exit.

### 5. Guide 3 curl fails (empty URL / no API key)

**Root cause:** `$ALEX_API_ENDPOINT` and `$ALEX_API_KEY` live in `.env`, but the terminal doesn't read `.env` automatically, so both variables were empty.

**Fix:** from the project root, run `set -a; source .env; set +a` once per terminal window, then the curl.

**Also:** the request body must use `"text"` (what `backend/ingest/ingest_s3vectors.py` reads). The sample curl in `terraform output` uses `"content"`, which the Lambda ignores. Follow the guide, not that sample.

### 6. Is `backend/output.json` a security risk?

No. It only contains the embedding numbers from the test call. It's throwaway output, so delete it rather than commit it.

The sensitive files are already excluded by `.gitignore`: `.env` (keys), `*.tfstate` (account ID, ARNs), `*.tfvars`, `.terraform/`. Check `git status` before every commit.

### 7. Aurora on the AWS Free plan (Guide 5)

**Errors, in order**
```
FreeTierRestrictionError: The specified backup retention period exceeds the maximum available to free tier customers.
FreeTierRestrictionError: To use Aurora clusters with free plan accounts you need to set WithExpressConfiguration.
```

**Root cause:** the account is on the AWS **Free plan** (`aws freetier get-account-plan-state`). It only allows Aurora **express** clusters: no VPC, IAM-token login only, no master password. Terraform has no `with_express_configuration` argument (checked up to provider 6.73), so the cluster can't be created by Terraform. The Data API, which all the course code uses, still works once it's enabled and has a password user.

**Fix (one-time, or after recreating the cluster):**

1. Add to IAM policy `AlexRDSCustomPolicy`: `"rds:Enable*"` and `"rds-db:connect"`. The console rejects the exact name `rds:EnableInternetAccessGateway` (not in IAM's action list yet, but AWS checks it), so use the wildcard.
2. Create the cluster (no `--database-name`; express rejects it):
   ```bash
   aws rds create-db-cluster --db-cluster-identifier alex-aurora-cluster --engine aurora-postgresql \
     --with-express-configuration --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=1
   aws rds wait db-cluster-available --db-cluster-identifier alex-aurora-cluster
   aws rds enable-http-endpoint --resource-arn <cluster ARN>
   ```
3. Create the `alexadmin` user (password from the Terraform secret) and the `alex` database:
   ```bash
   cd backend/database && uv run setup_express_db.py
   ```
4. `terraform/5_database/main.tf` now **looks up** the cluster (`data "aws_rds_cluster"`) instead of creating it, so `terraform apply` only manages the secret and the Lambda IAM role. Then copy `aurora_cluster_arn` / `aurora_secret_arn` from `terraform output` into `.env` and continue the guide at `uv run test_data_api.py`.

**Deleting the cluster to save credits:** `terraform destroy` no longer removes it. Use:
```bash
aws rds delete-db-instance --db-instance-identifier alex-aurora-cluster-instance-1
aws rds delete-db-cluster --db-cluster-identifier alex-aurora-cluster --skip-final-snapshot
```
Recreate later with steps 2–3, then rerun `run_migrations.py` and `seed_data.py`.

**On a paid plan** none of this is needed: `git show fbab9eb:terraform/5_database/main.tf` is the course version.

---

## Lessons

1. **Region is the #1 source of errors.** Every time a guide adds a config value, check it for a hardcoded region.
2. **Read the full error message.** It usually names the real problem, as the ECR error did.
3. **Destroy before changing region** in an applied Terraform directory.
4. **`terraform output`** is the source of truth for values to copy into `.env`.
5. **Cost:** the SageMaker serverless endpoint scales to zero; Aurora (Guide 5) is the big cost, so destroy it when not working.

## Next steps

- Guide 4 (`guides/4_researcher.md`): set `terraform/4_researcher/terraform.tfvars` with `aws_region = "us-east-1"`, make sure Bedrock model access is granted in `BEDROCK_REGION`, and have Docker Desktop running for `uv run deploy.py`.
- Guide 4 starts with `uv run cleanup_s3vectors.py`, which also removes the `api_test` document indexed above.
