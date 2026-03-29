#!/bin/bash
set -e

DOMAIN="revotake.golinkia.com"
EMAIL="admin@golinkia.com"

echo "=== Instalando Certbot ==="
apt-get update
apt-get install -y certbot python3-certbot-nginx

echo "=== Copiando config Nginx (HTTP only) ==="
cp /root/revotake/nginx/revotake.conf /etc/nginx/sites-available/revotake
ln -sf /etc/nginx/sites-available/revotake /etc/nginx/sites-enabled/revotake
nginx -t && systemctl reload nginx

echo "=== Obteniendo certificado SSL ==="
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

echo "=== Recargando Nginx con SSL ==="
nginx -t && systemctl reload nginx

echo "=== Configurando renovacion automatica ==="
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

echo "=== SSL instalado exitosamente para $DOMAIN ==="
certbot certificates
