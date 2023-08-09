FROM node:18
RUN mkdir -p /OpenAPI-QOS/node_modules && chown -R node:node /OpenAPI-QOS
WORKDIR /OpenAPI-QOS
COPY package.json .
USER node
RUN npm install
COPY --chown=node:node . .
CMD ["node", "cluster.js"]