#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate complete Vietnamese translation file for BuildWay
"""

import json
import os

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

def translate_text(text, path=""):
    """Translate English text to Vietnamese"""

    # Direct translations dictionary
    translations = {
        # Common
        "Premium": "Premium",
        "Copy": "Sao chép",
        "Save": "Lưu",
        "Cancel": "Hủy",
        "Submit": "Gửi",
        "Delete": "Xóa",
        "Edit": "Sửa",
        "View": "Xem",
        "Search": "Tìm kiếm",
        "Filter": "Lọc",
        "Close": "Đóng",
        "Confirm": "Xác nhận",
        "Loading...": "Đang tải...",
        "Saving...": "Đang lưu...",
        "Submitting...": "Đang gửi...",
        "Deleting...": "Đang xóa...",
        "Processing...": "Đang xử lý...",

        # Auth
        "Log in": "Đăng nhập",
        "Log out": "Đăng xuất",
        "Sign up": "Đăng ký",
        "Sign in": "Đăng nhập",
        "Login": "Đăng nhập",
        "Logout": "Đăng xuất",
        "Register": "Đăng ký",
        "Email": "Email",
        "Password": "Mật khẩu",
        "Name": "Tên",
        "Welcome back": "Chào mừng trở lại",
        "Create an account": "Tạo tài khoản",
        "Forgot Password?": "Quên mật khẩu?",
        "Forgot Password": "Quên mật khẩu",
        "Reset Password": "Đặt lại mật khẩu",
        "Show password": "Hiển thị mật khẩu",
        "Hide password": "Ẩn mật khẩu",
        "Or continue with": "Hoặc tiếp tục với",
        "Don't have an account? Sign up": "Chưa có tài khoản? Đăng ký",
        "Already have an account? Sign in": "Đã có tài khoản? Đăng nhập",
        "Back to login": "Quay lại đăng nhập",
        "Send reset link": "Gửi liên kết đặt lại",
        "Check your email": "Kiểm tra email của bạn",
        "Please check your email inbox": "Vui lòng kiểm tra hộp thư của bạn",

        # UI
        "Switch language": "Chuyển ngôn ngữ",
        "Toggle mode": "Chuyển chế độ",
        "Toggle theme": "Chuyển chủ đề",
        "Light": "Sáng",
        "Dark": "Tối",
        "System": "Hệ thống",
        "Default": "Mặc định",
        "Blue": "Xanh dương",
        "Green": "Xanh lá",
        "Amber": "Vàng cam",
        "Neutral": "Trung tính",

        # Table
        "Columns": "Cột",
        "Rows per page": "Hàng mỗi trang",
        "Page": "Trang",
        "First Page": "Trang đầu",
        "Last Page": "Trang cuối",
        "Next Page": "Trang tiếp",
        "Previous Page": "Trang trước",
        "Asc": "Tăng dần",
        "Desc": "Giảm dần",
        "Ascending": "Tăng dần",
        "Descending": "Giảm dần",
        "No results": "Không có kết quả",

        # Status
        "Active": "Hoạt động",
        "Inactive": "Không hoạt động",
        "Trial": "Dùng thử",
        "Free": "Miễn phí",
        "Lifetime": "Trọn đờii",
        "Pending": "Đang chờ",
        "Processing": "Đang xử lý",
        "Completed": "Hoàn thành",
        "Failed": "Thất bại",
        "Approved": "Đã duyệt",
        "Rejected": "Đã từ chối",
        "Published": "Đã xuất bản",
        "Draft": "Bản nháp",
        "Featured": "Nổi bật",
        "Archived": "Đã lưu trữ",

        # Navigation
        "Home": "Trang chủ",
        "Tools": "Công cụ",
        "Submit Tool": "Gửi công cụ",
        "Features": "Tính năng",
        "Pricing": "Giá cả",
        "Blog": "Blog",
        "About": "Về chúng tôi",
        "Docs": "Tài liệu",
        "Documentation": "Tài liệu",
        "Contact": "Liên hệ",
        "Dashboard": "Bảng điều khiển",
        "Settings": "Cài đặt",
        "Profile": "Hồ sơ",
        "Billing": "Thanh toán",
        "Credits": "Tín dụng",
        "History": "Lịch sử",

        # Pricing
        "Monthly": "Hàng tháng",
        "Yearly": "Hàng năm",
        "One-time": "Một lần",
        "Free trial": "Dùng thử miễn phí",
        "Most Popular": "Phổ biến nhất",
        "Current Plan": "Gói hiện tại",
        "Your Current Plan": "Gói hiện tại của bạn",
        "Sign Up Free": "Đăng ký miễn phí",
        "Get Started": "Bắt đầu",
        "Buy Now": "Mua ngay",
        "Not Available": "Không khả dụng",
        "Upgrade": "Nâng cấp",
        "Downgrade": "Hạ cấp",

        # Actions
        "Add": "Thêm",
        "Create": "Tạo",
        "Update": "Cập nhật",
        "Remove": "Xóa",
        "Refresh": "Làm mới",
        "Retry": "Thử lại",
        "Continue": "Tiếp tục",
        "Back": "Quay lại",
        "Next": "Tiếp",
        "Previous": "Trước",
        "Done": "Xong",
        "Finish": "Hoàn thành",

        # Errors
        "Error": "Lỗi",
        "Success": "Thành công",
        "Warning": "Cảnh báo",
        "Info": "Thông tin",
        "Something went wrong": "Đã xảy ra lỗi",
        "Please try again": "Vui lòng thử lại",
        "Network error": "Lỗi mạng",
        "Failed to load": "Tải thất bại",
        "Access denied": "Truy cập bị từ chối",
        "Not found": "Không tìm thấy",
        "Invalid input": "Đầu vào không hợp lệ",
        "Required": "Bắt buộc",

        # Time
        "Today": "Hôm nay",
        "Yesterday": "Hôm qua",
        "Tomorrow": "Ngày mai",
        "Now": "Bây giờ",
        "Never": "Không bao giờ",
        "Always": "Luôn luôn",

        # File
        "File": "Tệp",
        "Upload": "Tải lên",
        "Download": "Tải xuống",
        "Drag and drop": "Kéo và thả",
        "Browse": "Duyệt",
        "Select file": "Chọn tệp",
        "Change": "Thay đổi",

        # Misc
        "Yes": "Có",
        "No": "Không",
        "OK": "OK",
        "Cancel": "Hủy",
        "Apply": "Áp dụng",
        "Clear": "Xóa",
        "Reset": "Đặt lại",
        "All": "Tất cả",
        "None": "Không có",
        "Select all": "Chọn tất cả",
        "Deselect all": "Bỏ chọn tất cả",
        "More": "Thêm",
        "Less": "Ít hơn",
        "Show": "Hiển thị",
        "Hide": "Ẩn",
        "Expand": "Mở rộng",
        "Collapse": "Thu gọn",
        "Open": "Mở",
        "Close": "Đóng",
    }

    if text in translations:
        return translations[text]

    # Pattern-based translations
    if text.startswith("Total ") and " records" in text:
        return text.replace("Total ", "Tổng ").replace(" records", " bản ghi")

    if "-day free trial" in text:
        days = text.split("-")[0]
        return f"Dùng thử {days} ngày"

    if text.endswith(" min read"):
        minutes = text[:-9]
        return f"{minutes} phút đọc"

    if text.endswith(" min") and " read" not in text:
        minutes = text[:-4]
        return f"{minutes} phút"

    if " per month" in text or text.endswith("/month"):
        return text.replace(" per month", " mỗi tháng").replace("/month", "/tháng")

    if " per year" in text or text.endswith("/year"):
        return text.replace(" per year", " mỗi năm").replace("/year", "/năm")

    # Return original if no translation found
    return text

def translate_object(obj, path=""):
    """Recursively translate object"""
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            new_path = f"{path}.{key}" if path else key
            result[key] = translate_object(value, new_path)
        return result
    elif isinstance(obj, list):
        return [translate_object(item, f"{path}[{i}]") for i, item in enumerate(obj)]
    elif isinstance(obj, str):
        return translate_text(obj, path)
    else:
        return obj

def main():
    en_path = "D:/code/web/buildway/messages/en.json"
    vi_path = "D:/code/web/buildway/messages/vi.json"

    print(f"Loading {en_path}...")
    en_data = load_json(en_path)

    # Load existing vi.json if exists (skip if corrupted)
    existing_vi = {}
    if os.path.exists(vi_path):
        try:
            print(f"Loading existing {vi_path}...")
            existing_vi = load_json(vi_path)
        except json.JSONDecodeError:
            print(f"Warning: Existing {vi_path} is corrupted, starting fresh...")
            existing_vi = {}

    # Translate English to Vietnamese
    print("Translating...")
    vi_data = translate_object(en_data)

    # Merge with existing translations (existing takes priority)
    def deep_merge(d1, d2):
        result = d1.copy()
        for key, value in d2.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    final_vi = deep_merge(vi_data, existing_vi) if existing_vi else vi_data

    # Save result
    print(f"Saving to {vi_path}...")
    save_json(vi_path, final_vi)

    # Print statistics
    def count_keys(obj):
        count = 0
        if isinstance(obj, dict):
            for value in obj.values():
                if isinstance(value, dict):
                    count += count_keys(value)
                else:
                    count += 1
        return count

    total_keys = count_keys(final_vi)
    file_size = os.path.getsize(vi_path)
    print(f"\nStatistics:")
    print(f"  Total keys: {total_keys}")
    print(f"  File size: {file_size / 1024:.2f} KB")
    print("Done!")

if __name__ == "__main__":
    main()
