# 台股日資料查詢

一個純前端網頁應用程式。輸入台股代碼與日期區間後，會從台灣證券交易所 `STOCK_DAY` API 取得日成交資料，並在網頁上顯示摘要、明細表與收盤價折線圖。

## 功能

- 股票代碼查詢，例如 `0050`
- 自訂開始日期與結束日期
- 顯示交易日數、期末收盤、期間漲跌、最高收盤
- 繪製收盤價折線圖
- 顯示日成交資料表
- 匯出查詢結果 CSV
- 支援桌面與手機版版面

## 本機使用

直接開啟 `index.html` 即可使用。

如果瀏覽器對本機檔案有跨來源限制，可以用簡單伺服器啟動：

```bash
python3 -m http.server 8787
```

然後開啟：

```text
http://localhost:8787
```

## GitHub Pages 部署

1. 建立一個新的 GitHub repository。
2. 將本資料夾內的檔案上傳到 repository 根目錄。
3. 到 repository 的 `Settings`。
4. 進入 `Pages`。
5. Source 選擇 `Deploy from a branch`。
6. Branch 選擇 `main`，資料夾選 `/root`。
7. 儲存後等待 GitHub Pages 產生公開網址。

## 檔案結構

```text
stock-chart-app/
├── index.html
├── styles.css
├── app.js
├── README.md
├── .gitignore
└── .nojekyll
```

## 資料來源

資料來自台灣證券交易所公開 API：

```text
https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY
```

目前圖表使用證交所原始日資料，沒有做還原權值或分割調整。
