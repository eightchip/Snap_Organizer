use wasm_bindgen::prelude::*;
use image::{ImageBuffer, GenericImageView, DynamicImage};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::Cursor;
use web_sys::console;

const MAX_IMAGE_SIZE: u32 = 4096;

fn log(msg: &str) {
    console::log_1(&JsValue::from_str(msg));
}

fn scale_dimensions(width: u32, height: u32, max_size: u32) -> (u32, u32) {
    if width <= max_size && height <= max_size {
        return (width, height);
    }
    
    let aspect_ratio = width as f32 / height as f32;
    if width > height {
        let new_width = max_size;
        let new_height = (new_width as f32 / aspect_ratio) as u32;
        (new_width, new_height)
    } else {
        let new_height = max_size;
        let new_width = (new_height as f32 * aspect_ratio) as u32;
        (new_width, new_height)
    }
}

#[wasm_bindgen]
pub fn resize_image(
    base64_image: &str,
    max_width: u32,
    max_height: u32,
    quality: f32
) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    log(&format!("Starting resize_image with max_width={}, max_height={}, quality={}", max_width, max_height, quality));

    // Base64デコード
    let base64_data = match base64_image.split(",").nth(1) {
        Some(data) => data,
        None => {
            log("Invalid base64 format: missing comma separator");
            return Err(JsValue::from_str("Invalid base64 format: missing comma separator"));
        }
    };

    let image_data = match BASE64.decode(base64_data) {
        Ok(data) => data,
        Err(e) => {
            log(&format!("Base64 decode error: {}", e));
            return Err(JsValue::from_str(&format!("Base64 decode error: {}", e)));
        }
    };

    // 画像のデコード
    let img = match image::load_from_memory(&image_data) {
        Ok(img) => img,
        Err(e) => {
            log(&format!("Image decode error: {}", e));
            return Err(JsValue::from_str(&format!("Image decode error: {}", e)));
        }
    };

    // 大きすぎる画像のサイズを制限
    let (width, height) = img.dimensions();
    log(&format!("Original image dimensions: {}x{}", width, height));
    
    let (width, height) = scale_dimensions(width, height, MAX_IMAGE_SIZE);
    log(&format!("Scaled dimensions (if needed): {}x{}", width, height));
    
    let img = if width != img.width() || height != img.height() {
        log("Performing initial resize to max dimensions");
        img.resize(width, height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // ユーザー指定のサイズにリサイズ
    let (new_width, new_height) = scale_dimensions(width, height, max_width.max(max_height));
    log(&format!("Final resize dimensions: {}x{}", new_width, new_height));
    
    let resized = img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);

    // JPEG形式でエンコード
    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);
    if let Err(e) = resized.write_to(&mut cursor, image::ImageOutputFormat::Jpeg((quality as u8).max(1).min(100))) {
        log(&format!("JPEG encode error: {}", e));
        return Err(JsValue::from_str(&format!("JPEG encode error: {}", e)));
    }

    // Base64エンコード
    let base64_output = format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(&jpeg_data)
    );

    log("Image processing completed successfully");
    Ok(base64_output)
}

#[wasm_bindgen]
pub fn preprocess_image_for_ocr(base64_image: &str) -> Result<String, JsValue> {
    console_error_panic_hook::set_once();
    log("Starting preprocess_image_for_ocr");

    // Base64デコード
    let base64_data = match base64_image.split(",").nth(1) {
        Some(data) => data,
        None => {
            log("Invalid base64 format: missing comma separator");
            return Err(JsValue::from_str("Invalid base64 format: missing comma separator"));
        }
    };

    let image_data = match BASE64.decode(base64_data) {
        Ok(data) => data,
        Err(e) => {
            log(&format!("Base64 decode error: {}", e));
            return Err(JsValue::from_str(&format!("Base64 decode error: {}", e)));
        }
    };

    // 画像のデコード
    let img = match image::load_from_memory(&image_data) {
        Ok(img) => img,
        Err(e) => {
            log(&format!("Image decode error: {}", e));
            return Err(JsValue::from_str(&format!("Image decode error: {}", e)));
        }
    };

    // 大きすぎる画像のサイズを制限
    let (width, height) = img.dimensions();
    log(&format!("Original image dimensions: {}x{}", width, height));
    
    let (width, height) = scale_dimensions(width, height, MAX_IMAGE_SIZE);
    log(&format!("Scaled dimensions (if needed): {}x{}", width, height));
    
    let img = if width != img.width() || height != img.height() {
        log("Performing initial resize to max dimensions");
        img.resize(width, height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // OCR前処理
    log("Converting to grayscale");
    let mut processed = DynamicImage::ImageLuma8(img.to_luma8());

    // コントラスト自動調整
    log("Adjusting contrast");
    processed = DynamicImage::ImageLuma8(
        ImageBuffer::from_fn(processed.width(), processed.height(), |x, y| {
            let pixel = processed.get_pixel(x, y).0[0] as f32;
            let normalized = (pixel - 128.0) * 1.5 + 128.0;
            let clamped = normalized.max(0.0).min(255.0) as u8;
            image::Luma([clamped])
        })
    );

    // シャープネス強調
    log("Applying sharpening");
    let kernel = [
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0,
    ];
    let processed = processed.filter3x3(&kernel);

    // JPEG形式でエンコード（高品質）
    log("Encoding to JPEG");
    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);
    if let Err(e) = processed.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(95)) {
        log(&format!("JPEG encode error: {}", e));
        return Err(JsValue::from_str(&format!("JPEG encode error: {}", e)));
    }

    // Base64エンコード
    let base64_output = format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(&jpeg_data)
    );

    log("Image preprocessing completed successfully");
    Ok(base64_output)
}

#[wasm_bindgen]
pub fn batch_resize_images(
    images: js_sys::Array,      // JSから渡されるUint8Array[]（画像バイナリ配列）
    qualities: js_sys::Array,   // JSから渡されるf32[]（品質配列）
    max_width: u32,
    max_height: u32,
) -> js_sys::Array {
    let mut result = js_sys::Array::new();
    for (i, img_val) in images.iter().enumerate() {
        let img_bytes = js_sys::Uint8Array::new(&img_val).to_vec();
        let quality = qualities.get(i as u32).as_f64().unwrap_or(0.8) as f32;
        // 画像デコード
        if let Ok(img) = image::load_from_memory(&img_bytes) {
            // リサイズ
            let resized = img.thumbnail(max_width, max_height);
            // JPEGエンコード
            let mut buf = Cursor::new(Vec::new());
            let _ = resized.write_to(&mut buf, image::ImageOutputFormat::Jpeg((quality * 100.0) as u8));
            // JSのUint8Arrayに変換してpush
            let js_buf = js_sys::Uint8Array::from(buf.get_ref().as_slice());
            result.push(&js_buf);
        }
    }
    result
}