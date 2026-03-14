module.exports = {
  apps: [{
    name: "soulorangerie-api",
    script: "index.js",
    cwd: "/opt/soulorangerie-platform/server",
    env: {
      JWT_SECRET: "72637d5b04afa58ea13b0ff1383e88464a84dd57d3f399984c0f2d59f9b1b0de",
      NODE_ENV: "production",
      PORT: 3100
    }
  }]
};
