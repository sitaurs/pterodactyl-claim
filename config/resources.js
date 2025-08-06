// Resource Configuration untuk Server Pterodactyl
module.exports = {
  // Server Resources (MB dan %)
  memory: 1024,        // RAM dalam MB
  disk: 10240,         // Disk dalam MB  
  cpu: 100,            // CPU limit dalam %
  swap: 0,             // Swap dalam MB
  io: 500,             // IO weight
  
  // Feature Limits
  databases: 2,
  allocations: 1,
  backups: 5,
  
  // Port Range Info (untuk dokumentasi)
  portRange: {
    start: 7000,
    end: 7200,
    currentlyUsed: [7000, 7001, 7002, 7003],
    available: 196  // 200 total - 4 used
  }
};
