FROM ubuntu:latest

ENV BUN_INSTALL=${HOME}/.bun
ENV PATH=${BUN_INSTALL}/bin:${PATH}

RUN apt update && apt upgrade -y
RUN apt install unzip curl -y

# Install bun
RUN curl https://bun.sh/install | bash

# Install node (webpack still uses node)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash
RUN apt install nodejs -y

COPY . ${HOME}
WORKDIR ${HOME}

RUN bun install
RUN bun run build

ENTRYPOINT ["bun", "run", "launch"]
