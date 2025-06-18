use wasm_bindgen::prelude::*;
use image::{ImageBuffer, GenericImageView};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use std::io::Cursor;

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

    // アスペクト比を維持したリサイズ計算
    let (width, height) = img.dimensions();
    let aspect_ratio = width as f32 / height as f32;
    let mut new_width = width;
    let mut new_height = height;

    if width > max_width {
        new_width = max_width;
        new_height = (new_width as f32 / aspect_ratio) as u32;
    }
    if new_height > max_height {
        new_height = max_height;
        new_width = (new_height as f32 * aspect_ratio) as u32;
    }

    // リサイズ実行
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

    // グレースケール変換
    let gray_img = img.to_luma8();

    // コントラスト強調
    let contrast_img = ImageBuffer::from_fn(gray_img.width(), gray_img.height(), |x, y| {
        let pixel = gray_img.get_pixel(x, y).0[0] as f32;
        let normalized = (pixel - 128.0) * 1.5 + 128.0;
        let clamped = normalized.max(0.0).min(255.0) as u8;
        image::Luma([clamped])
    });

    // JPEG形式でエンコード
    let mut jpeg_data = Vec::new();
    let mut cursor = Cursor::new(&mut jpeg_data);
    contrast_img.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(90))
        .map_err(|e| JsValue::from_str(&format!("JPEG encode error: {}", e)))?;

    // Base64エンコード
    let base64_output = format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(&jpeg_data)
    );

    Ok(base64_output)
}