# Build for ARM64 (hAP ax3 architecture)
# Build with: docker buildx build --platform linux/arm64 -t powercowo-agent --output type=docker .
# Export with: docker save powercowo-agent | gzip > powercowo-agent.tar
# Upload with: scp powercowo-agent.tar admin@<router-vpn-ip>:/disk1/

FROM --platform=linux/arm64 node:22-alpine

WORKDIR /app
COPY package.json index.js ./

EXPOSE 3000
CMD ["node", "index.js"]
