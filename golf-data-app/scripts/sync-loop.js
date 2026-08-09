const http = require('http');

const syncData = () => {
  console.log(`[${new Date().toISOString()}] Triggering DataGolf Sync...`);
  http.get('http://localhost:3000/api/sync', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(`Sync Response: ${data}`);
    });
  }).on('error', (err) => {
    console.error(`Sync Error: ${err.message}`);
  });
};

syncData();
setInterval(syncData, 60000);
console.log('Sync loop started. Polling every 1 minute...');
