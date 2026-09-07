FROM nginx:1.27-alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY index.html crear.html config.js /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY fotos /usr/share/nginx/html/fotos
COPY assets /usr/share/nginx/html/assets
COPY mome /usr/share/nginx/html/mome

ENV PORT=10000
EXPOSE 10000
