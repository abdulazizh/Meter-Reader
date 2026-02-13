module.exports = {
  apps : [{
    name: "meter-reader-server",
    script: "npm.cmd",
    args: "run server:dev",
    env: {
      NODE_ENV: "development",
    }
  }]
}
