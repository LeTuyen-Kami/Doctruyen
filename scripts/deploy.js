const { execSync } = require("child_process");

const platform = process.env.PLATFORM || process.argv[2];

const version = process.env.VERSION || process.argv[3];

if (!platform || !version) {
  console.error(
    "❌ Thiếu tham số\n" +
      "👉 npm run deploy -- ios 1.2.3\n" +
      "👉 npm run deploy -- android 1.2.3"
  );
  process.exit(1);
}

const config = {
  ios: {
    app: "Doctruyen",
    path: "./build-ios",
  },
  android: {
    app: "Doctruyen",
    path: "./build-android",
  },
};

if (!config[platform]) {
  console.error("❌ Platform không hợp lệ:", platform);
  process.exit(1);
}

const { app, path } = config[platform];

const cmd = `revopush release ${app} ${path} ${version} -d Production --mandatory`;

console.log("🚀 Deploying...");
console.log("Platform :", platform);
console.log("Version  :", version);
console.log("Command  :", cmd);

execSync(cmd, { stdio: "inherit" });
