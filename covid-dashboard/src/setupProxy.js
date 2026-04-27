const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

module.exports = function setupProxy(app) {
  app.get('/api/who-global-data-local.csv', (req, res) => {
    const localCsvPath = path.resolve(__dirname, '../csv/WHO-COVID-19-global-data.csv');
    res.sendFile(localCsvPath);
  });

  app.use(
    '/api/kr-covid',
    createProxyMiddleware({
      target: 'https://apis.data.go.kr',
      changeOrigin: true,
      pathRewrite: {
        '^/api/kr-covid': '/1352000/ODMS_COVID_04/callCovid04Api'
      }
    })
  );

  app.use(
    '/api/who-global-data.csv',
    createProxyMiddleware({
      target: 'https://srhdpeuwpubsa.blob.core.windows.net',
      changeOrigin: true,
      pathRewrite: {
        '^/api/who-global-data.csv': '/whdh/COVID/WHO-COVID-19-global-data.csv'
      },
      headers: {
        Accept: 'text/csv,application/csv,text/plain,*/*'
      }
    })
  );
};
