FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY index.html crear.html config.js ./
COPY css ./css
COPY js ./js
COPY fotos ./fotos
COPY assets ./assets
COPY mome ./mome
COPY server.py ./

ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT:-10000} --timeout 120 server:app"]
