FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server.js"]
