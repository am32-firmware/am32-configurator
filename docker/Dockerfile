FROM node:lts-alpine AS base
WORKDIR /usr/src/app

FROM base AS prerelease
WORKDIR /usr/src/app
COPY . .

ENV NODE_ENV=production
ENV REDIS_HOST=cache
RUN corepack enable && yarn set version berry
RUN yarn install
RUN yarn run build

FROM base AS release
COPY --chown=node:node --from=prerelease /usr/src/app/node_modules node_modules
COPY --chown=node:node --from=prerelease /usr/src/app/.output .

USER node
ENV HOST=0.0.0.0
ENV REDIS_HOST=cache
EXPOSE 3000
ENTRYPOINT [ "node", "server/index.mjs" ]