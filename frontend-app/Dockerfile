# Stage 1: Angular build
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Nginx runtime
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular build çıktısını Nginx içine kopyala
COPY --from=build /app/dist/frontend-app/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]