FROM node:18
RUN mkdir -p /OpenAPI-SQM/node_modules && chown -R node:node /OpenAPI-SQM
WORKDIR /OpenAPI-SQM
COPY package.json .
USER node
RUN npm install
COPY --chown=node:node . .
CMD ["node", "cluster.js"]