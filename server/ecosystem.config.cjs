module.exports = {
  apps: [{
    name: "soulorangerie-api",
    script: "index.js",
    cwd: "/opt/soulorangerie-platform/server",
    env: {
      JWT_SECRET: "72637d5b04afa58ea13b0ff1383e88464a84dd57d3f399984c0f2d59f9b1b0de",
      NODE_ENV: "production",
      PORT: 3100,
      GEMINI_API_KEY: "AIzaSyCCs-wpR9aECIG1ZB8BOFepOgbV1BPcWzU",
      TG_BOT_TOKEN: "8772429793:AAHMfyPg6Se204GfkXw8l8EF_rNTL_e9wnE"
    }
  }]
};
