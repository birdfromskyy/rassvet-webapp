# Stage 1 — build
FROM node:20-alpine AS builder

WORKDIR /app

# REACT_APP_API_URL is baked into the bundle at build time
ARG REACT_APP_API_URL=http://localhost:8080/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1536"
# Do not ship source maps — keeps the original (readable) source out of
# browser DevTools → Sources. The app still works; only the .map files
# that reverse the minified bundle are omitted.
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Stage 2 — serve with nginx
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
