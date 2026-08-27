# Wordsy is a static site: HTML, CSS and JS with no build step and no backend.
# Serving it is the whole job, so there is nothing to compile and no reason
# for a multi-stage build.
FROM nginx:1.29-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy only what the browser asks for — deployment scripts, word-list tooling
# and repo metadata stay out of the image.
COPY index.html favicon.svg /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost/ || exit 1
