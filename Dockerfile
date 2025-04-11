FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Note: This should match the PORT in your .env or the default in server.js
EXPOSE 4444

CMD [ "node", "server.js" ]
