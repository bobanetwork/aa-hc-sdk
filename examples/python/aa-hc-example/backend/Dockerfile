FROM python:3.9-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
EXPOSE ${OC_LISTEN_PORT:-1234}
CMD ["python", "-u", "server.py"]