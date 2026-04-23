# Crowdfunding DApp (Sepolia)

Ứng dụng gọi vốn cộng đồng on-chain với giao diện hiện đại, hiển thị lịch sử giao dịch, trạng thái chiến dịch, và tên người dùng lưu vĩnh viễn trên blockchain.
Link deploy web trên vercel: https://crowdfunding-dapp-indol.vercel.app/
## Tính năng chính

- Tạo chiến dịch với tên, mục tiêu và thời gian kêu gọi.
- Góp vốn theo chiến dịch, theo dõi tiến độ real-time qua events.
- Rút tiền khi đạt mục tiêu, hoàn tiền khi không đạt.
- Lịch sử giao dịch (pledge/claim/refund) và link Etherscan.
- Theo dõi (watchlist) và lọc theo chiến dịch đã lưu.
- Tên người dùng on-chain (ai cũng thấy), có thể đổi tên.
- Trạng thái thông minh: Đang mở / Đã hết hạn / Đã hoàn tiền / Đã nhận vốn.
- Cảnh báo chiến dịch sắp hết hạn.

## Công nghệ sử dụng

- Solidity ^0.8.20
- Hardhat v3 (ESM)
- Next.js 16 + TypeScript
- Ethers v6
- MetaMask

## Cấu trúc thư mục

- contracts/ : Smart contract Crowdfunding
- scripts/ : Deploy script
- frontend/ : Next.js app

## Smart Contract

Hợp đồng: `Crowdfunding.sol`

Các hàm chính:

- `createCampaign(name, goal, duration)`
- `pledge(id)`
- `claim(id)`
- `refund(id)`
- `openCampaignCount(creator)`
- `setUserName(name)`
- `userNames(address)`

Ràng buộc:

- Mỗi tài khoản chỉ có tối đa 5 chiến dịch đang mở.
- Tên chiến dịch và tên người dùng: 1-32 ký tự.

## Cài đặt và chạy dự án

### 1) Cài dependencies

```bash
npm install
```

### 2) Cấu hình môi trường

Tạo file `.env` ở root:

```env
SEPOLIA_RPC_URL=YOUR_RPC_URL
PRIVATE_KEY=YOUR_PRIVATE_KEY
```

### 3) Compile

```bash
npm run compile
```

### 4) Deploy contract

```bash
npm run deploy
```

Sau khi deploy, cập nhật `contractAddress` trong `frontend/lib/contract.ts`.

### 5) Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt: http://localhost:3000

## Demo nhanh (step-by-step)

1. Kết nối ví MetaMask (Sepolia).
2. Nếu chưa có tên, nhập và lưu tên người dùng.
3. Tạo chiến dịch mới.
4. Góp vốn vào chiến dịch và xem lịch sử.
5. Demo hoàn tiền hoặc rút tiền tùy trạng thái.
6. Xem Etherscan từ icon ở lịch sử.

## Ghi chú

- Sau mỗi lần sửa contract, cần deploy lại và cập nhật `contractAddress`.
- Nếu giao dịch chậm trên Sepolia, chờ thêm hoặc refresh lại trang.

## Tác giả

- Sinh viên: Nguyễn Duy Tường, Huỳnh Thanh Duy, Nguyễn Thị Kỳ Duyên, Đỗ Nguyễn Khiêm
- Môn học: Công nghệ Blockchain và ứng dụng
- Giảng viên: Huỳnh Minh Châu
