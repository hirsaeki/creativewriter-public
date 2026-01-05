# Stage 1: Build Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy build artifacts from stage 1
COPY --from=build /app/dist/creativewriter2/browser /usr/share/nginx/html

# Nginx configuration template for envsubst
# Official nginx image will run envsubst on files in /etc/nginx/templates/*.template
# and output to /etc/nginx/conf.d/*.conf
COPY nginx/nginx-cliproxy.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080