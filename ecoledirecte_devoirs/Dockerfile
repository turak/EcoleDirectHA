FROM node:20-alpine

RUN apk add --no-cache git

# Build the EcoleDirecte MCP server from its upstream source.
WORKDIR /opt
RUN git clone --depth 1 https://github.com/jeromeboivin/EcoleDirecteMCP.git ecoledirecte-mcp \
    && cd ecoledirecte-mcp \
    && npm install \
    && npm run build

# Our scheduler app
WORKDIR /opt/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

ENV HOME=/data
ENV ECOLEDIRECTE_MCP_DIR=/opt/ecoledirecte-mcp

CMD [ "node", "index.mjs" ]
