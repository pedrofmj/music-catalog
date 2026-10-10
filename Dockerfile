FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/web/dist /usr/share/nginx/html

COPY deploy/kubernetes/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080