#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vietnamese Translation Generator for BuildWay
Generates complete vi.json translation file from en.json
"""

import json
import os

def load_json(filepath):
    """Load JSON file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    """Save JSON file with proper formatting"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

def translate_value(key_path, value):
    """
    Translate a single value based on its key path and content
    Uses Vietnamese translations
    """
    if not isinstance(value, str):
        return value

    # Common translations dictionary for frequently used terms
    translations = {
        # Common UI
        "Premium": "Premium",
        "Log in": "Đăng nhập",
        "Log out": "Đăng xuất",
        "Sign up": "Đăng ký",
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
        "Copy": "Sao chép",
        "Save": "Lưu",
        "Saving...": "Đang lưu...",
        "Loading...": "Đang tải...",
        "Cancel": "Hủy",
        "Failed to log out": "Đăng xuất thất bại",

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
        "No results": "Không có kết quả",

        # Pricing
        "Monthly": "Hàng tháng",
        "Yearly": "Hàng năm",
        "Most Popular": "Phổ biến nhất",
        "Current Plan": "Gói hiện tại",
        "Your Current Plan": "Gói hiện tại của bạn",
        "Sign Up Free": "Đăng ký miễn phí",
        "Get Lifetime Access": "Nhận quyền truy cập trọn đờii",
        "Buy Now": "Mua ngay",
        "Not Available": "Không khả dụng",

        # Status
        "Active": "Hoạt động",
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

        # Navigation
        "Tools": "Công cụ",
        "Submit Tool": "Gửi công cụ",
        "Features": "Tính năng",
        "Pricing": "Giá cả",
        "Blog": "Blog",
        "About": "Về chúng tôi",
        "Docs": "Tài liệu",
        "Contact": "Liên hệ",

        # Actions
        "Edit": "Sửa",
        "Delete": "Xóa",
        "View": "Xem",
        "Search": "Tìm kiếm",
        "Filter": "Lọc",
        "Submit": "Gửi",
        "Confirm": "Xác nhận",
        "Close": "Đóng",

        # Errors
        "Something went wrong": "Đã xảy ra lỗi",
        "Please try again": "Vui lòng thử lại",
        "Network error": "Lỗi mạng",
    }

    # Check direct translation
    if value in translations:
        return translations[value]

    # Pattern-based translations
    if value.startswith("Total ") and value.endswith(" records"):
        count = value[6:-8]
        return f"Tổng {count} bản ghi"

    if "-day free trial" in value:
        days = value.split("-")[0]
        return f"Dùng thử {days} ngày"

    if value.endswith(" min read"):
        minutes = value[:-9]
        return f"{minutes} phút đọc"

    if value.endswith(" min") and " read" not in value:
        minutes = value[:-4]
        return f"{minutes} phút"

    # Return original if no translation found (will be handled manually)
    return None

def deep_translate(obj, path=""):
    """
    Recursively translate all strings in the object
    """
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            new_path = f"{path}.{key}" if path else key
            result[key] = deep_translate(value, new_path)
        return result
    elif isinstance(obj, list):
        return [deep_translate(item, f"{path}[{i}]") for i, item in enumerate(obj)]
    elif isinstance(obj, str):
        translated = translate_value(path, obj)
        return translated if translated else obj
    else:
        return obj

def main():
    # Load English source
    en_path = "D:/code/web/buildway/messages/en.json"
    vi_path = "D:/code/web/buildway/messages/vi.json"

    print(f"Loading {en_path}...")
    en_data = load_json(en_path)

    # Load existing Vietnamese translations if available
    existing_vi = {}
    if os.path.exists(vi_path):
        print(f"Loading existing {vi_path}...")
        existing_vi = load_json(vi_path)

    # Create comprehensive Vietnamese translation
    vi_data = create_vietnamese_translation(en_data, existing_vi)

    # Save the result
    print(f"Saving to {vi_path}...")
    save_json(vi_path, vi_data)

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

    total_keys = count_keys(vi_data)
    file_size = os.path.getsize(vi_path)
    print(f"\nStatistics:")
    print(f"  Total keys: {total_keys}")
    print(f"  File size: {file_size / 1024:.2f} KB")
    print("Done!")

def create_vietnamese_translation(en_data, existing_vi):
    """
    Create complete Vietnamese translation based on English source
    Preserves existing translations where available
    """

    # Start with existing translations
    vi_data = existing_vi.copy() if existing_vi else {}

    # Define all translations
    translations = {
        "Metadata": {
            "name": "BuildWay",
            "title": "BuildWay - Khám Phá Công Cụ AI Tốt Nhất | Danh Mục Công Cụ AI",
            "description": "Khám phá và tìm hiểu các công cụ AI tốt nhất cho mọi nhu cầu. Danh mục công cụ AI hoàn hảo của bạn với bộ sưu tập được chọn lọc, đánh giá và đề xuất."
        },
        "ImageTask": {
            "submitting": "Đang gửi tác vụ...",
            "submitted": "Tác vụ đã được gửi, đang tạo...",
            "generating": "Đang tạo...",
            "queuing": "Đang xếp hàng...",
            "completed": "Tạo hoàn tất!",
            "cancelled": "Đã hủy",
            "generationFailed": "Tạo thất bại, vui lòng thử lại",
            "submitError": "Gửi thất bại, vui lòng thử lại",
            "submitFailed": "Gửi thất bại: {status}",
            "requestFailed": "Yêu cầu thất bại: {status}",
            "networkError": "Lỗi mạng, vui lòng thử lại",
            "timeout": "Tác vụ hết thờigian, vui lòng thử lại sau"
        },
        "Common": {
            "premium": "Premium",
            "login": "Đăng nhập",
            "logout": "Đăng xuất",
            "signUp": "Đăng ký",
            "language": "Chuyển ngôn ngữ",
            "mode": {
                "label": "Chuyển chế độ",
                "light": "Sáng",
                "dark": "Tối",
                "system": "Hệ thống"
            },
            "theme": {
                "label": "Chuyển chủ đề",
                "default": "Mặc định",
                "blue": "Xanh dương",
                "green": "Xanh lá",
                "amber": "Vàng cam",
                "neutral": "Trung tính"
            },
            "copy": "Sao chép",
            "saving": "Đang lưu...",
            "save": "Lưu",
            "loading": "Đang tải...",
            "cancel": "Hủy",
            "logoutFailed": "Đăng xuất thất bại",
            "table": {
                "totalRecords": "Tổng {count} bản ghi",
                "noResults": "Không có kết quả",
                "loading": "Đang tải...",
                "columns": "Cột",
                "rowsPerPage": "Hàng mỗi trang",
                "page": "Trang",
                "firstPage": "Trang đầu",
                "lastPage": "Trang cuối",
                "nextPage": "Trang tiếp",
                "previousPage": "Trang trước",
                "ascending": "Tăng dần",
                "descending": "Giảm dần"
            }
        },
        "PricingPage": {
            "title": "Gửi Công Cụ AI Củabạn",
            "description": "Đưa công cụ AI của bạn lên danh mục của chúng tôi",
            "subtitle": "Thanh toán một lần, sử dụng bất cứ lúc nào. Không cần đăng ký.",
            "monthly": "Hàng tháng",
            "yearly": "Hàng năm",
            "submitTool": {
                "title": "Đưa Công Cụ AI Củabạn Lên Nổi Bật",
                "subtitle": "Tiếp cận hàng nghìn ngườidùng tiềmnăng bằng cách liệt kê công cụ AI của bạn trên danh mục của chúng tôi",
                "badge": "Thanh Toán Một Lần",
                "packageName": "Gửi Công Cụ",
                "packageDescription": "Có vị trí vĩnh viễn trong danh mục công cụ AI của chúng tôi",
                "oneTime": "Thanh toán một lần, liệt kê trọn đờii",
                "submitButton": "Gửi Công Cụ Củabạn"
            },
            "PricingCard": {
                "freePrice": "$0",
                "perMonth": "/tháng",
                "perYear": "/năm",
                "popular": "Phổ biến nhất",
                "currentPlan": "Gói Hiện Tại",
                "yourCurrentPlan": "Gói Hiện Tại Củabạn",
                "getStartedForFree": "Đăng Ký Miễn Phí",
                "getLifetimeAccess": "Nhận Quyền Truy Cập Trọn Đờii",
                "getStarted": "Mua Ngay",
                "notAvailable": "Không khả dụng",
                "daysTrial": "Dùng thử {days} ngày"
            },
            "CheckoutButton": {
                "loading": "Đang tải...",
                "checkoutFailed": "Không thể mở trang thanh toán",
                "checkoutNetworkError": "Lỗi mạng. Vui lòng kiểm tra kết nối và thử lại."
            },
            "credits": {
                "features": {
                    "allModels": "Truy cập tất cả các mô hình AI",
                    "noExpiry": "Tín dụng có hiệu lực 1 năm",
                    "standardSupport": "Hỗ trợ tiêu chuẩn",
                    "prioritySupport": "Hỗ trợ ưu tiên",
                    "bestValue": "Giá trị tốt nhất",
                    "bulkDiscount": "Giảm giá số lượng lớn tốt nhất"
                },
                "registerGift": "Đăng ký ngay và nhận {amount} tín dụng miễn phí!",
                "validityNotice": "Tín dụng từ các gói hiện tại có hiệu lực trong 1 năm"
            },
            "faqs": {
                "title": "Câu Hỏi Thường Gặp",
                "subtitle": "Mọi thứ bạn cần biết về các gói tín dụng của chúng tôi",
                "items": {
                    "item-1": {
                        "question": "Tín dụng có hiệu lực bao lâu?",
                        "answer": "Tín dụng mua từ các gói của chúng tôi có hiệu lực trong 1 năm kể từ ngày mua. Bạn có thể sử dụng chúng bất cứ lúc nào trong thờigian này cho bất kỳ tính năng chỉnh sửa ảnh AI nào."
                    },
                    "item-2": {
                        "question": "Làm thế nào để mua tín dụng?",
                        "answer": "Chỉ cần chọn một gói tín dụng phù hợp với nhu cầu của bạn và nhấp 'Mua Ngay'. Bạn sẽ được chuyển hướng đến trang thanh toán an toàn nơi bạn có thể hoàn tất giao dịch bằng thẻ tín dụng hoặc các phương thức thanh toán khác được hỗ trợ."
                    },
                    "item-3": {
                        "question": "Sự khác biệt giữa các gói là gì?",
                        "answer": "Starter (200 tín dụng) hoàn hảo cho ngườimới bắt đầu. Popular (1000 tín dụng) cung cấp giá trị tốt nhất với hỗ trợ ưu tiên. Pro (3000 tín dụng) cung cấp giảm giá số lượng lớn tốt nhất cho các chuyên gia cần nhiều tín dụng hơn."
                    },
                    "item-4": {
                        "question": "Tôi có thể sử dụng tín dụng cho tất cả các tính năng AI không?",
                        "answer": "Có! Tất cả tín dụng đã mua có thể được sử dụng cho bất kỳ tính năng chỉnh sửa ảnh AI nào trên nền tảng của chúng tôi, bao gồm xóa nền, nâng cao hình ảnh, nâng cấp và tất cả các mô hình AI khác."
                    },
                    "item-5": {
                        "question": "Điều gì xảy ra nếu tín dụng của tôi hết hạn?",
                        "answer": "Tín dụng hết hạn sau 1 năm kể từ ngày mua. Chúng tôi khuyên bạn nên sử dụng chúng trước khi hết hạn. Bạn có thể kiểm tra số dư tín dụng và ngày hết hạn trong bảng điều khiển tài khoản của bạn."
                    },
                    "item-6": {
                        "question": "Tôi có thể chuyển tín dụng sang tài khoản khác không?",
                        "answer": "Không, tín dụng không thể chuyển nhượng và gắn liền với tài khoản đã mua chúng. Điều này giúp chúng tôi duy trì bảo mật và ngăn chặn gian lận."
                    },
                    "item-7": {
                        "question": "Bạn có cung cấp hoàn tiền không?",
                        "answer": "Chúng tôi cung cấp hoàn tiền trong vòng 30 ngày kể từ ngày mua nếu bạn chưa sử dụng quá 10% tín dụng của mình. Vui lòng liên hệ với đội ngũ hỗ trợ của chúng tôi để được hỗ trợ với các yêu cầu hoàn tiền."
                    },
                    "item-8": {
                        "question": "Bạn chấp nhận những phương thức thanh toán nào?",
                        "answer": "Chúng tôi chấp nhận tất cả các thẻ tín dụng chính, thẻ ghi nợ và PayPal. Tất cả các khoản thanh toán đều được xử lý an toàn thông qua Stripe, đảm bảo thông tin thanh toán của bạn được bảo vệ."
                    }
                }
            },
            "modelCredits": {
                "badge": "Mô Hình AI",
                "title": "Sử Dụng Tín Dụng Mô Hình",
                "subtitle": "Các mô hình khác nhau có các tính năng và chi phí tín dụng độc đáo. Chọn mô hình tốt nhất cho nhu cầu của bạn.",
                "columns": {
                    "model": "Tên Mô Hình",
                    "features": "Tính Năng",
                    "useCases": "Trường Hợp Sử Dụng",
                    "credits": "Tín Dụng"
                },
                "tags": {
                    "fastGeneration": "Tạo Nhanh",
                    "strongConsistency": "Tính Nhất Quán Cao",
                    "strongComprehension": "Hiểu Biết Mạnh",
                    "4kHd": "4K HD",
                    "multiImageGen": "Tạo Nhiều Hình",
                    "ultraFast": "Cực Nhanh",
                    "highQuality": "Chất Lượng Cao",
                    "asyncProcess": "Xử Lý Bất Đồng Bộ"
                },
                "useCases": {
                    "nano-banana": "Tạo nhanh, sáng tạo hàng ngày, bài đăng mạng xã hội",
                    "nano-banana-pro": "Đầu ra độ phân giải cao, sử dụng thương mại, tài liệu in ấn",
                    "seedream-4-5": "Tạo hàng loạt, tính nhất quán phong cách, tạo series",
                    "z-image-turbo": "Xem trước tức thì, lặp lại nhanh chóng, khám phá sáng tạo"
                },
                "perGeneration": "tín dụng/lần tạo",
                "note": "Mức tiêu thụ tín dụng thay đổi tùy theo mô hình. Các mô hình cao cấp cung cấp đầu ra chất lượng cao hơn."
            }
        },
        "PricePlans": {
            "free": {
                "name": "Miễn phí",
                "description": "Dùng thử chỉnh sửa ảnh AI miễn phí",
                "features": {
                    "feature-1": "2 tín dụng mỗi tháng",
                    "feature-2": "Kích thước tệp tối đa 2MB",
                    "feature-3": "Độ phân giải tối đa 1024×1024",
                    "feature-4": "Hàng đợi xử lý tiêu chuẩn",
                    "feature-5": "Lưu giữ lịch sử 60 ngày",
                    "feature-6": "Hỗ trợ cộng đồng"
                },
                "limits": {}
            },
            "basic": {
                "name": "Cơ bản",
                "description": "Dành cho nhu cầu chỉnh sửa ảnh hàng ngày",
                "features": {
                    "feature-1": "200 tín dụng/tháng",
                    "feature-2": "Kích thước tệp tối đa 20MB",
                    "feature-3": "Độ phân giải tối đa 2048×2048",
                    "feature-4": "Hàng đợi xử lý tiêu chuẩn",
                    "feature-5": "Lưu giữ lịch sử 1 năm",
                    "feature-6": "Hỗ trợ qua email (48h phản hồi)"
                }
            },
            "pro": {
                "name": "Chuyên nghiệp",
                "description": "Dành cho chuyên gia và ngườidùng nâng cao",
                "features": {
                    "feature-1": "500 tín dụng/tháng",
                    "feature-2": "Kích thước tệp tối đa 20MB",
                    "feature-3": "Độ phân giải tối đa 4096×4096 (4K)",
                    "feature-4": "Hàng đợi xử lý ưu tiên",
                    "feature-5": "Lưu giữ lịch sử vĩnh viễn",
                    "feature-6": "Lưu cài đặt tùy chỉnh",
                    "feature-7": "Hỗ trợ ưu tiên (24h phản hồi)",
                    "feature-8": "Truy cập sớm các tính năng mới"
                }
            }
        },
        "CreditPackages": {
            "starter": {
                "name": "Starter",
                "description": "Hoàn hảo cho ngườimới bắt đầu"
            },
            "popular": {
                "name": "Phổ biến",
                "description": "Giá trị tốt nhất"
            },
            "pro": {
                "name": "Chuyên nghiệp",
                "description": "Dành cho chuyên gia"
            }
        },
        "NotFoundPage": {
            "title": "404",
            "message": "Xin lỗi, trang bạn đang tìm kiếm không tồn tại.",
            "backToHome": "Về trang chủ"
        },
        "ErrorPage": {
            "title": "Ôi! Đã xảy ra lỗi!",
            "tryAgain": "Thử lại",
            "backToHome": "Về trang chủ"
        },
        "AboutPage": {
            "title": "Về chúng tôi",
            "description": "BuildWay là danh mục công cụ AI tối ưu của bạn. Khám phá, so sánh và chọn công cụ AI tốt nhất cho dự án của bạn.",
            "authorName": "BuildWay",
            "authorBio": "Nền tảng Danh mục & Khám phá Công cụ AI",
            "introduction": "BuildWay là một danh mục được chọn lọc kỹ lưỡng về các công cụ AI tốt nhất hiện có. Cho dù bạn là nhà phát triển, nhà thiết kế, nhà tiếp thị hay doanh nhân, chúng tôi giúp bạn khám phá và so sánh các công cụ AI để tìm giải pháp hoàn hảo cho nhu cầu của bạn. Từ công cụ năng suất đến AI sáng tạo, chúng tôi làm cho việc tìm kiếm công cụ AI phù hợp trở nên đơn giản và hiệu quả.",
            "talkWithMe": "Liên hệ với chúng tôi",
            "followMe": "Theo dõi chúng tôi"
        },
        "ChangelogPage": {
            "title": "Nhật ký Thay đổi",
            "description": "Theo dõi hành trình của chúng tôi khi liên tục cải thiện và mở rộng danh mục công cụ AI",
            "subtitle": "Mỗi bản cập nhật mang đến công cụ mới và tính năng tốt hơn",
            "startPoint": "Nơi mọi thứ bắt đầu",
            "latestVersion": "Mới nhất"
        },
        "ContactPage": {
            "title": "Liên hệ",
            "description": "Chúng tôi sẽ giúp bạn tìm gói phù hợp cho doanh nghiệp của bạn",
            "subtitle": "Chúng tôi sẽ giúp bạn tìm gói phù hợp cho doanh nghiệp của bạn",
            "form": {
                "title": "Liên hệ với chúng tôi",
                "description": "Nếu bạn có bất kỳ câu hỏi hoặc phản hồi nào, vui lòng liên hệ với đội ngũ của chúng tôi",
                "name": "Tên",
                "email": "Email",
                "message": "Tin nhắn",
                "submit": "Gửi",
                "submitting": "Đang gửi...",
                "success": "Tin nhắn đã được gửi thành công",
                "fail": "Gửi tin nhắn thất bại",
                "nameMinLength": "Tên phải có ít nhất 3 ký tự",
                "nameMaxLength": "Tên không được vượt quá 30 ký tự",
                "emailValidation": "Vui lòng nhập địa chỉ email hợp lệ",
                "messageMinLength": "Tin nhắn phải có ít nhất 10 ký tự",
                "messageMaxLength": "Tin nhắn không được vượt quá 500 ký tự"
            }
        },
        "WaitlistPage": {
            "title": "Danh sách chờ",
            "description": "Tham gia danh sách chờ để nhận thông tin mới nhất về sản phẩm của chúng tôi",
            "subtitle": "Tham gia danh sách chờ để nhận thông tin mới nhất về sản phẩm của chúng tôi",
            "form": {
                "title": "Tham gia Danh sách Chờ",
                "description": "Chúng tôi sẽ thông báo cho bạn khi sản phẩm của chúng tôi ra mắt",
                "email": "Email",
                "subscribe": "Đăng ký",
                "subscribing": "Đang đăng ký...",
                "success": "Đăng ký thành công",
                "fail": "Đăng ký thất bại",
                "emailValidation": "Vui lòng nhập địa chỉ email hợp lệ"
            }
        },
        "Newsletter": {
            "title": "Bản tin",
            "subtitle": "Tham gia cộng đồng",
            "description": "Đăng ký bản tin của chúng tôi để nhận tin tức và cập nhật mới nhất",
            "form": {
                "email": "Email",
                "subscribe": "Đăng ký",
                "subscribing": "Đang đăng ký...",
                "success": "Đăng ký thành công",
                "fail": "Đăng ký thất bại",
                "emailValidation": "Vui lòng nhập địa chỉ email hợp lệ"
            }
        },
        "AuthPage": {
            "login": {
                "title": "Đăng nhập",
                "welcomeBack": "Chào mừng trở lại",
                "email": "Email",
                "password": "Mật khẩu",
                "signIn": "Đăng nhập",
                "signUpHint": "Chưa có tài khoản? Đăng ký",
                "forgotPassword": "Quên mật khẩu?",
                "signInWithGoogle": "Đăng nhập bằng Google",
                "signInWithGitHub": "Đăng nhập bằng GitHub",
                "showPassword": "Hiển thị mật khẩu",
                "hidePassword": "Ẩn mật khẩu",
                "or": "Hoặc tiếp tục với",
                "emailRequired": "Vui lòng nhập email",
                "passwordRequired": "Vui lòng nhập mật khẩu",
                "captchaInvalid": "Xác minh captcha thất bại",
                "captchaError": "Lỗi xác minh captcha"
            },
            "register": {
                "title": "Đăng ký",
                "createAccount": "Tạo tài khoản",
                "name": "Tên",
                "email": "Email",
                "password": "Mật khẩu",
                "signUp": "Đăng ký",
                "signInHint": "Đã có tài khoản? Đăng nhập",
                "checkEmail": "Vui lòng kiểm tra hộp thư của bạn",
                "showPassword": "Hiển thị mật khẩu",
                "hidePassword": "Ẩn mật khẩu",
                "nameRequired": "Vui lòng nhập tên",
                "emailRequired": "Vui lòng nhập email",
                "passwordRequired": "Vui lòng nhập mật khẩu",
                "captchaInvalid": "Xác minh captcha thất bại",
                "captchaError": "Lỗi xác minh captcha"
            },
            "forgotPassword": {
                "title": "Quên mật khẩu",
                "email": "Email",
                "send": "Gửi liên kết đặt lại",
                "backToLogin": "Quay lại đăng nhập",
                "checkEmail": "Vui lòng kiểm tra hộp thư của bạn",
                "emailRequired": "Vui lòng nhập email"
            },
            "resetPassword": {
                "title": "Đặt lại mật khẩu",
                "password": "Mật khẩu",
                "reset": "Đặt lại mật khẩu",
                "backToLogin": "Quay lại đăng nhập",
                "showPassword": "Hiển thị mật khẩu",
                "hidePassword": "Ẩn mật khẩu",
                "minLength": "Mật khẩu phải có ít nhất 8 ký tự"
            },
            "error": {
                "title": "Ôi! Đã xảy ra lỗi!",
                "tryAgain": "Vui lòng thử lại.",
                "backToLogin": "Quay lại đăng nhập",
                "checkEmail": "Vui lòng kiểm tra hộp thư của bạn"
            },
            "common": {
                "termsOfService": "Điều khoản Dịch vụ",
                "privacyPolicy": "Chính sách Bảo mật",
                "byClickingContinue": "Bằng cách nhấp tiếp tục, bạn đồng ý với ",
                "and": " và "
            }
        },
        "BlogPage": {
            "title": "Blog",
            "description": "Thông tin chi tiết về công cụ AI, xu hướng ngành và hướng dẫn từ chuyên gia",
            "subtitle": "Cập nhật thông tin mới nhất về công cụ AI và công nghệ",
            "author": "Tác giả",
            "categories": "Danh mục",
            "tableOfContents": "Mục lục",
            "readTime": "{minutes} phút đọc",
            "readTimeShort": "{minutes} phút",
            "all": "Tất cả",
            "noPostsFound": "Không tìm thấy bài viết",
            "allPosts": "Tất cả bài viết",
            "morePosts": "Thêm bài viết"
        },
        "DocsPage": {
            "toc": "Mục lục",
            "search": "Tìm kiếm tài liệu",
            "lastUpdate": "Cập nhật lần cuối",
            "searchNoResult": "Không có kết quả",
            "previousPage": "Trước",
            "nextPage": "Tiếp",
            "chooseLanguage": "Chọn ngôn ngữ",
            "title": "Tài liệu BuildWay",
            "homepage": "Trang chủ"
        },
        "PremiumContent": {
            "title": "Mở khóa Nội dung Premium",
            "description": "Đăng ký gói Pro của chúng tôi để truy cập tất cả nội dung premium và nội dung độc quyền.",
            "upgradeCta": "Nâng cấp ngay",
            "benefit1": "Tất cả nội dung premium",
            "benefit2": "Nội dung độc quyền",
            "benefit3": "Hủy bất cứ lúc nào",
            "signIn": "Đăng nhập",
            "loginRequired": "Đăng nhập để tiếp tục đọc",
            "loginDescription": "Đây là nội dung premium. Vui lòng đăng nhập để truy cập nội dung đầy đủ.",
            "checkingAccess": "Đang kiểm tra quyền truy cập...",
            "loadingContent": "Đang tải nội dung đầy đủ..."
        },
    }

    # Merge with existing translations
    for key, value in translations.items():
        if key not in vi_data:
            vi_data[key] = value
        elif isinstance(value, dict) and isinstance(vi_data.get(key), dict):
            # Deep merge for nested dictionaries
            vi_data[key] = deep_merge(vi_data[key], value)

    return vi_data

def deep_merge(existing, new):
    """Deep merge two dictionaries"""
    result = existing.copy()
    for key, value in new.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

if __name__ == "__main__":
    main()
