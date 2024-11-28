const express = require("express");
const path = require("path");
const axios = require("axios");
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require("fs");

const app = express();
const port = 3000;

// Middleware để xử lý body request dạng JSON
app.use(express.json());

// Để Express phục vụ các tệp tĩnh (index.html và các tệp khác trong thư mục public)
app.use(express.static(path.join(__dirname, 'public')));

// API để kiểm tra một proxy
app.post('/check-proxy', async (req, res) => {
  const { proxy } = req.body;
  const [ip, port, username, password] = proxy.split(':');
  const proxyUrl = `http://${username}:${password}@${ip}:${port}`;

  try {
    const agent = new HttpsProxyAgent(proxyUrl);
    const response = await axios.get('https://ipinfo.io/json', { httpsAgent: agent });

    const result = {
      result: `${proxy} => ${response.data.ip} - ${response.data.city} - ${response.data.org}`,
      location: response.data.city,  // Thành phố
      isp: response.data.org,       // ISP nhà mạng
      ip: response.data.ip,         // Địa chỉ IP kiểm tra
    };

    res.json(result);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// API để kiểm tra nhiều proxy cùng lúc
app.post('/check-proxies', async (req, res) => {
  const proxyList = req.body.proxies; // Danh sách proxy
  const promises = proxyList.map((proxy) => 
    fetch('http://localhost:3000/check-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proxy })
    })
    .then((response) => response.json())
  );

  try {
    const results = await Promise.all(promises); // Đợi tất cả kết quả trả về
    res.json(results); // Trả lại kết quả cho client
  } catch (error) {
    res.json({ error: error.message });
  }
});

// API để tải kết quả theo địa điểm
app.post('/download-by-location', async (req, res) => {
  const proxyList = req.body.proxies; // Danh sách proxy
  const promises = proxyList.map((proxy) => 
    fetch('http://localhost:3000/check-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proxy })
    })
    .then((response) => response.json())
  );

  try {
    const results = await Promise.all(promises); // Đợi tất cả kết quả trả về
    const groupedResults = {};

    // Nhóm kết quả theo địa chỉ và nhà mạng
    results.forEach(result => {
      if (result.error) return;
      const locationKey = `${result.location} - ${result.isp}`;
      if (!groupedResults[locationKey]) {
        groupedResults[locationKey] = [];
      }
      groupedResults[locationKey].push(`${result.ip}:${result.proxy.split(":")[1]} => ${result.ip}`);
    });

    // Chuyển dữ liệu nhóm vào một chuỗi
    let downloadData = '';
    Object.keys(groupedResults).forEach((location) => {
      downloadData += `${location}:\n`;
      groupedResults[location].forEach(line => {
        downloadData += `${line}\n`;
      });
      downloadData += '\n';
    });

    // Gửi file tải xuống cho client
    res.header('Content-Type', 'text/plain');
    res.attachment('proxy_results_by_location.txt');
    res.send(downloadData);
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Khởi động server tại cổng 3000
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
