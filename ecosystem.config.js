module.exports = {
  apps: [
    {
      name: "tvnew",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3002,
        MONGODB_URI :"mongodb+srv://userTvAd995511:adminTvAd995511@tvads.wor5u.mongodb.net/?retryWrites=true&w=majority&appName=TvAds",
        JWT_EXPIRES_IN: "7d",
        JWT_SECRET: "sfisdopfjsd5dq5qdZFEfefefzefz5e4dZEMLFKP88/*-SFDS§F.£µ",
        REFRESH_EXPIRY: "70d",
        REFRESH_SECRET: "!!:5*--$$8daaaifgjefjsd^pofj^pkfs5dfsdf4sde8fsdf5sdf5s4f5sda:"
      }
    }
  ]
};
