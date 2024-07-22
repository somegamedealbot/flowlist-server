FROM node:20-slim
WORKDIR /home/node/app
COPY package.json ./
RUN npm install
COPY . .
