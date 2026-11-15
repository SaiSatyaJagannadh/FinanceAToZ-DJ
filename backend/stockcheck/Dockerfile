FROM public.ecr.aws/lambda/python:3.12

# Node runs FinAI's scoring engines (engine/*.js, no npm dependencies)
RUN dnf install -y nodejs && dnf clean all

COPY pyproject.toml ./
RUN pip install uv && uv pip install --system --no-cache -r pyproject.toml

COPY handler.py ./
COPY engine/ ./engine/

CMD ["handler.lambda_handler"]
