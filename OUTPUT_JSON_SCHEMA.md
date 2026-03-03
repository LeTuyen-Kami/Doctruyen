# Cấu trúc file JSON xuất ra (`khotruyenchu_crawler.py`)

Script `khotruyenchu_crawler.py` sẽ crawl thông tin truyện + danh sách chương và ghi ra **một JSON object** vào file output (mặc định: `story.json`).

## Tổng quan

- **Kiểu dữ liệu gốc**: `object`
- **Đường dẫn file output**: theo tham số `--output` (mặc định `story.json`)
- **Thứ tự chương**: được cố gắng giữ đúng thứ tự link thu thập được; các chương crawl lỗi sẽ bị bỏ qua (không có `null` trong mảng `chapters`).

## Schema (root object)

| Field | Type | Bắt buộc | Mô tả / nguồn dữ liệu |
|---|---:|:---:|---|
| `id` | `string` | ✓ | Slug cuối của `--url` (VD: `https://.../huyen-giam-tien-toc/` → `huyen-giam-tien-toc`) |
| `title` | `string` | ✓ | Tiêu đề truyện từ `h1.elementor-heading-title` (fallback: `h2.elementor-heading-title`, hoặc `"Unknown Title"`) |
| `author` | `string` | ✓ | Tác giả (cố tìm text chứa `"Tác giả:"`, fallback `"Unknown Author"`) |
| `description` | `string` | ✓ | Mô tả (lấy từ `.elementor-widget-text-editor`, ưu tiên đoạn dài > 100 ký tự và không chứa `"Tác giả:"`) |
| `chapters` | `array<object>` | ✓ | Danh sách chương đã crawl thành công |

## Schema (chapter object trong `chapters[]`)

| Field | Type | Bắt buộc | Mô tả / nguồn dữ liệu |
|---|---:|:---:|---|
| `id` | `string` | ✓ | Slug cuối của URL chương (VD: `.../chuong-123/` → `chuong-123`) |
| `title` | `string` | ✓ | Tiêu đề chương từ `h1.entry-title` (fallback: title của link đã thu thập) |
| `content` | `string` | ✓ | Nội dung từ `div.entry-content p`, join bằng newline `\n` (đã loại `script/style`) |

## Ví dụ JSON mẫu (rút gọn)

```json
{
  "id": "huyen-giam-tien-toc",
  "title": "Huyền Giám Tiên Tộc",
  "author": "Tác Giả A",
  "description": "Mô tả truyện...",
  "chapters": [
    {
      "id": "chuong-1",
      "title": "Chương 1: ...",
      "content": "Đoạn 1...\nĐoạn 2...\nĐoạn 3..."
    },
    {
      "id": "chuong-2",
      "title": "Chương 2: ...",
      "content": "..."
    }
  ]
}
```

## Ghi chú

- Script có dùng `index` nội bộ để giữ thứ tự khi tải song song, nhưng **`index` không được ghi ra JSON**.
- Nếu một chương không fetch/parse được, chương đó sẽ **không xuất hiện** trong `chapters`.

