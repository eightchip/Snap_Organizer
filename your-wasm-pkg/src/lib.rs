use wasm_bindgen::prelude::*;
use image::{ImageBuffer, GenericImageView, DynamicImage};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::Cursor;

const MAX_IMAGE_SIZE: u32 = 4096;

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
    // エラーハンドリングの設定
    console_error_panic_hook::set_once();

    // Base64デコード
    let base64_data = base64_image.split(",").nth(1)
        .ok_or_else(|| JsValue::from_str("Invalid base64 format"))?;
    let image_data = BASE64.decode(base64_data)
        .map_err(|e| JsValue::from_str(&format!("Base64 decode error: {}", e)))?;

    // 画像のデコード
    let img = image::load_from_memory(&image_data)
        .map_err(|e| JsValue::from_str(&format!("Image decode error: {}", e)))?;

    // 大きすぎる画像のサイズを制限
    let (width, height) = img.dimensions();
    let (width, height) = scale_dimensions(width, height, MAX_IMAGE_SIZE);
    let img = if width != img.width() || height != img.height() {
        img.resize(width, height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // ユーザー指定のサイズにリサイズ
    let (new_width, new_height) = scale_dimensions(width, height, max_width.max(max_height));
    let resized = img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);

    // JPEG形式でエンコード
    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);
    resized.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(quality as u8))
        .map_err(|e| JsValue::from_str(&format!("JPEG encode error: {}", e)))?;

    // Base64エンコード
    let base64_output = format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(&jpeg_data)
    );

    Ok(base64_output)
}

#[wasm_bindgen]
pub fn preprocess_image_for_ocr(base64_image: &str) -> Result<String, JsValue> {
    // エラーハンドリングの設定
    console_error_panic_hook::set_once();

    // Base64デコード
    let base64_data = base64_image.split(",").nth(1)
        .ok_or_else(|| JsValue::from_str("Invalid base64 format"))?;
    let image_data = BASE64.decode(base64_data)
        .map_err(|e| JsValue::from_str(&format!("Base64 decode error: {}", e)))?;

    // 画像のデコード
    let img = image::load_from_memory(&image_data)
        .map_err(|e| JsValue::from_str(&format!("Image decode error: {}", e)))?;

    // 大きすぎる画像のサイズを制限
    let (width, height) = img.dimensions();
    let (width, height) = scale_dimensions(width, height, MAX_IMAGE_SIZE);
    let img = if width != img.width() || height != img.height() {
        img.resize(width, height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // OCR前処理
    let mut processed = DynamicImage::ImageLuma8(img.to_luma8());

    // コントラスト自動調整
    processed = DynamicImage::ImageLuma8(
        ImageBuffer::from_fn(processed.width(), processed.height(), |x, y| {
            let pixel = processed.get_pixel(x, y).0[0] as f32;
            let normalized = (pixel - 128.0) * 1.5 + 128.0;
            let clamped = normalized.max(0.0).min(255.0) as u8;
            image::Luma([clamped])
        })
    );

    // シャープネス強調
    let kernel = [
        -1.0, -1.0, -1.0,
        -1.0,  9.0, -1.0,
        -1.0, -1.0, -1.0,
    ];
    let processed = processed.filter3x3(&kernel);

    // JPEG形式でエンコード（高品質）
    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);
    processed.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(95))
        .map_err(|e| JsValue::from_str(&format!("JPEG encode error: {}", e)))?;

    // Base64エンコード
    let base64_output = format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(&jpeg_data)
    );

    Ok(base64_output)
}