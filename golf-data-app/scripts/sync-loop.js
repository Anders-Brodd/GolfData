const http = require('http');

const syncData = () => {
  console.log([] Triggering DataGolf Sync...);
  http.get('http://localhost:3000/api/sync', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(Sync Response: );
    });
  }).on('error', (err) => {
    console.error(Sync Error: );
  });
};

// Run immediately once
syncData();

// Run every 60 seconds
setInterval(syncData, 60000);
console.log('Sync loop started. Polling every 1 minute...');
