use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageBuffer, Luma, Rgb, ImageFormat};
use imageproc::contrast::threshold;
use imageproc::filter::gaussian_blur_f32;
use imageproc::geometric_transformations::{rotate_about_center, Interpolation};
use imageproc::morphology::{dilate, erode};
use imageproc::distance_transform::Norm;
use std::io::Cursor;

#[wasm_bindgen]
pub fn preprocess_image(image_data: &[u8]) -> Vec<u8> {
    // 画像データを読み込む
    let img = image::load_from_memory(image_data).unwrap();
    
    // グレースケールに変換
    let gray = img.to_luma8();
    
    // 二値化
    let binarized = threshold(&gray, 128);
    
    // ノイズ除去（モルフォロジー演算）
    let denoised = erode(&dilate(&binarized, Norm::L1, 1), Norm::L1, 1);
    
    // コントラスト強調
    let mut contrast = denoised.clone();
    for pixel in contrast.pixels_mut() {
        let value = pixel[0] as f32;
        let new_value = ((value - 128.0) * 1.5 + 128.0).clamp(0.0, 255.0) as u8;
        pixel[0] = new_value;
    }
    
    // 画像をPNGとしてエンコード
    let mut buf = Cursor::new(Vec::new());
    contrast.write_to(&mut buf, ImageFormat::Png).unwrap();
    
    buf.into_inner()
}

#[wasm_bindgen]
pub fn preprocess_image_color(image_data: &[u8]) -> Vec<u8> {
    let img = image::load_from_memory(image_data).unwrap();
    let (orig_w, orig_h) = img.dimensions();
    let max_w = 1000;
    let max_h = 1000;
    let scale = f32::min(max_w as f32 / orig_w as f32, max_h as f32 / orig_h as f32).min(1.0);
    let new_w = (orig_w as f32 * scale).round() as u32;
    let new_h = (orig_h as f32 * scale).round() as u32;
    let img = img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3);
    let mut buf = Cursor::new(Vec::new());
    img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
    buf.into_inner()
}