FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

# Host deps phvm.py shells out to (qemu, cloud-init tooling, ssh helpers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    qemu-system-x86 qemu-utils cloud-image-utils \
    wget curl sshpass openssh-client git \
    python3 python3-pip python3-venv \
    cpu-checker psmisc net-tools iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI only (no daemon) — used to run Minecraft / Bot servers as containers on the
# HOST's Docker through the mounted socket (see docker-compose.yml).
RUN (curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
    | tar -xz --strip-components=1 -C /usr/local/bin docker/docker) \
    || echo "WARNING: docker CLI not installed — Minecraft/Bot servers will fall back to VMs"

WORKDIR /opt/phvm
COPY . /opt/phvm

RUN python3 -m venv venv \
    && venv/bin/pip install --upgrade pip \
    && venv/bin/pip install -r requirements.txt

EXPOSE 5050
CMD ["/opt/phvm/venv/bin/python", "/opt/phvm/phvm.py"]
