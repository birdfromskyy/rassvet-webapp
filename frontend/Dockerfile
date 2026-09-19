# Stage 1 — build
FROM node:26.8.2-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked into the bundle at build time.
ARG VITE_API_URL=http://localhost:8080/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# Stage 2 — serve with nginx
FROM nginx:1.30.5-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
