FROM clamav/clamav@sha256:c6fc61da368cee0df3d78a79855fee4e76db7988d9dbbc434f5e1d1d24867b8a
USER root
RUN apk add --no-cache python3 py3-pip
COPY requirements.txt /opt/tuveloz/requirements.txt
RUN python3 -m venv /opt/tuveloz/venv && /opt/tuveloz/venv/bin/pip install --no-cache-dir --require-hashes -r /opt/tuveloz/requirements.txt
COPY document_policy.py scan_file.py runner.py /opt/tuveloz/
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TZ=UTC LC_ALL=C.UTF-8
USER clamav
ENTRYPOINT ["/opt/tuveloz/venv/bin/python", "/opt/tuveloz/scan_file.py"]
