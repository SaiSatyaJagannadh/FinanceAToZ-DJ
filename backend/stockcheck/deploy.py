"""
Build the stock check image, push it to ECR and deploy terraform/9_stockcheck.
Docker Desktop must be running.

    uv run deploy.py
"""

import json
import subprocess
import time
from pathlib import Path

HERE = Path(__file__).parent
TF = HERE.parent.parent / "terraform" / "9_stockcheck"


def run(cmd, **kw):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, check=True, **kw)


def tf_output(name):
    return run(["terraform", "output", "-raw", name], cwd=TF, capture_output=True, text=True).stdout.strip()


run(["terraform", "init", "-input=false"], cwd=TF)
run(["terraform", "apply", "-auto-approve", "-input=false", "-target=aws_ecr_repository.stockcheck"], cwd=TF)
ecr = tf_output("ecr_repository_url")
region = ecr.split(".")[3]

password = run(["aws", "ecr", "get-login-password", "--region", region], capture_output=True, text=True).stdout
run(["docker", "login", "--username", "AWS", "--password-stdin", ecr.split("/")[0]], input=password, text=True)

image = f"{ecr}:deploy-{int(time.time())}"
run(["docker", "build", "--platform", "linux/amd64", "--provenance=false", "-t", image, str(HERE)])
run(["docker", "push", image])

(TF / "stockcheck.auto.tfvars.json").write_text(json.dumps({"stockcheck_image_uri": image}, indent=2) + "\n")
run(["terraform", "apply", "-auto-approve", "-input=false"], cwd=TF)

print(f"\n✅ Deployed. Set this in frontend/.env.local and .env.production:\nNEXT_PUBLIC_STOCKCHECK_URL={tf_output('stockcheck_url').rstrip('/')}")
