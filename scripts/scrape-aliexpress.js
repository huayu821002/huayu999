/**
 * AliExpress 产品采集脚本
 * 使用方法: node scrape-aliexpress.js <产品URL或搜索页URL>
 * 
 * 示例:
 *   node scrape-aliexpress.js "https://www.aliexpress.com/item/4000000000000.html"
 *   node scrape-aliexpress.js "https://www.aliexpress.com/wholesale?SearchText=phone+case"
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// 解析HTML获取数据
function extractProductData(html) {
  const data = {};
  
  // 提取标题
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    data.title = titleMatch[1].replace('- AliExpress', '').trim();
  }
  
  // 提取价格
  const priceMatch = html.match(/'"priceAmount":["']?([\d.]+)["']?'/);
  if (priceMatch) {
    data.price = parseFloat(priceMatch[1]);
  }
  
  // 提取图片 - 多种方式
  const images = [];
  const imgMatches = html.match(/https?:\/\/[^"']+\.(jpg|jpeg|png|webp)/gi);
  if (imgMatches) {
    const uniqueImages = [...new Set(imgMatches)];
    uniqueImages.slice(0, 10).forEach(img => {
      // 只保留大图
      if (img.includes('300x300') || img.includes('220x220')) return;
      images.push(img.split('?')[0]); // 去掉URL参数
    });
  }
  data.images = images;
  
  // 提取描述 (如果有script数据)
  const descMatch = html.match(/window\.__INIT_PROPS__\s*=\s*(\{.*?\});/s);
  if (descMatch) {
    try {
      const props = JSON.parse(descMatch[1]);
      if (props.productDescription) {
        data.description = props.productDescription;
      }
    } catch (e) {}
  }
  
  // 提取SKU
  const skuMatch = html.match(/productId["']?\s*:\s*["']?(\d+)["']?/);
  if (skuMatch) {
    data.sku = 'AE-' + skuMatch[1];
  }
  
  return data;
}

// 简化版：直接获取页面HTML
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      }
    };
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      // 处理gzip
      if (res.headers['content-encoding'] === 'gzip') {
        const zlib = require('zlib');
        const gunzip = zlib.createGunzip();
        res.pipe(gunzip);
        gunzip.on('data', (chunk) => data += chunk);
        gunzip.on('end', () => resolve(data));
        gunzip.on('error', reject);
      } else {
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      }
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 生成CSV
function generateCSV(products) {
  const headers = ['商品名称', '价格', '图片', '描述', 'SKU'];
  const rows = products.map(p => [
    p.name || p.title || '',
    p.price || 0,
    (p.images || []).join(','),
    (p.description || '').replace(/"/g, '""'),
    p.sku || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📦 AliExpress 产品采集脚本

使用方法:
  node scrape-aliexpress.js <产品URL或搜索页URL>

示例:
  node scrape-aliexpress.js "https://www.aliexpress.com/item/4000000000000.html"
  node scrape-aliexpress.js "https://www.aliexpress.com/wholesale?SearchText=phone+case"
    `);
    process.exit(0);
  }
  
  const url = args[0];
  console.log(`🔍 开始采集: ${url}`);
  
  try {
    const html = await fetchPage(url);
    const data = extractProductData(html);
    
    if (!data.title && !data.price) {
      console.log('⚠️ 未能解析到产品数据，可能是反爬限制');
      console.log('💡 建议:');
      console.log('   1. 手动复制产品信息');
      console.log('   2. 使用 AliTools 浏览器插件');
      console.log('   3. 购买专业采集工具');
      process.exit(1);
    }
    
    console.log('\n✅ 采集成功!');
    console.log(`   标题: ${data.title || 'N/A'}`);
    console.log(`   价格: ${data.price || 'N/A'}`);
    console.log(`   图片: ${data.images?.length || 0} 张`);
    console.log(`   SKU: ${data.sku || 'N/A'}`);
    
    // 生成CSV
    const csv = generateCSV([data]);
    const outputFile = `aliexpress-products-${Date.now()}.csv`;
    fs.writeFileSync(outputFile, csv);
    console.log(`\n📄 CSV已生成: ${outputFile}`);
    console.log('💡 请在后台导入此CSV文件');
    
  } catch (error) {
    console.error('❌ 采集失败:', error.message);
    console.log('\n💡 常见问题:');
    console.log('   1. AliExpress 有反爬机制，频繁访问可能被封');
    console.log('   2. 建议使用专业工具如 Findiate (£299/月)');
    console.log('   3. 或者使用 AliTools 浏览器插件(免费)');
    process.exit(1);
  }
}

main();
