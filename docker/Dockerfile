FROM node:22-alpine AS base
WORKDIR /usr/src/app

FROM base AS prerelease
WORKDIR /usr/src/app
COPY . .

ARG DATABASE_URL
ENV CI='true'
ENV YARN_ENABLE_INLINE_BUILDS='true'
ENV NODE_ENV=production
ENV REDIS_HOST=cache
ENV DATABASE_URL="${DATABASE_URL:-mysql://am32:am32password@mariadb:3306/am32}"
RUN corepack enable && yarn set version berry
RUN npm -g i tsx
RUN yarn --immutable
RUN yarn run prepare
RUN yarn prisma:generate
RUN yarn run build

USER node
ENV HOST=0.0.0.0
ENV REDIS_HOST=cache
EXPOSE 3000

ENTRYPOINT [ "node", ".output/server/index.mjs" ]