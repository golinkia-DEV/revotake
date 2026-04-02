#!/bin/bash
set -e

DOMAIN="public-revotake.golinkia.com"
EMAIL="admin@golinkia.com"

echo "=== Instalando Certbot (si no está instalado) ==="
apt-get update -q
apt-get install -y certbot python3-certbot-nginx

echo "=== Copiando config Nginx para $DOMAIN ==="
cp /root/revotake/nginx/public-revotake.conf /etc/nginx/sites-available/public-revotake
ln -sf /etc/nginx/sites-available/public-revotake /etc/nginx/sites-enabled/public-revotake

echo "=== Creando carpeta para challenge ACME ==="
mkdir -p /var/www/certbot

echo "=== Habilitando solo bloque HTTP temporalmente para verificación ==="
# Comentar el bloque SSL si el certificado aún no existe
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Crear config temporal solo HTTP para que certbot pueda verificar
  cat > /etc/nginx/sites-available/public-revotake-temp <<'NGINX'
server {
    listen 80;
    server_name public-revotake.golinkia.com;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/public-revotake-temp /etc/nginx/sites-enabled/public-revotake
  nginx -t && systemctl reload nginx

  echo "=== Obteniendo certificado SSL ==="
  certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$EMAIL"

  echo "=== Activando config completa con SSL ==="
  cp /root/revotake/nginx/public-revotake.conf /etc/nginx/sites-available/public-revotake
  ln -sf /etc/nginx/sites-available/public-revotake /etc/nginx/sites-enabled/public-revotake
  rm -f /etc/nginx/sites-available/public-revotake-temp
else
  echo "=== Certificado ya existe, recargando config ==="
fi

nginx -t && systemctl reload nginx

echo "=== Configurando renovación automática ==="
(crontab -l 2>/dev/null | grep -v "certbot renew" ; echo "0 3 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

echo "=== SSL instalado exitosamente para $DOMAIN ==="
certbot certificates | grep -A 5 "$DOMAIN"
