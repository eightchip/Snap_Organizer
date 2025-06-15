use wasm_bindgen::prelude::*;
use image::{DynamicImage, ImageBuffer, Luma, Rgb, ImageFormat};
use imageproc::contrast::threshold;
use imageproc::filter::gaussian_blur_f32;
use imageproc::geometric_transformations::{rotate_about_center, Interpolation};
use imageproc::morphology::{dilate, erode};

#[wasm_bindgen]
pub fn preprocess_image(image_data: &[u8]) -> Vec<u8> {
    // 画像データを読み込む
    let img = image::load_from_memory(image_data).unwrap();
    
    // グレースケールに変換
    let gray = img.to_luma8();
    
    // 二値化
    let binarized = threshold(&gray, 128);
    
    // ノイズ除去（モルフォロジー演算）
    let denoised = erode(&dilate(&binarized, 1), 1);
    
    // コントラスト強調
    let mut contrast = denoised.clone();
    for pixel in contrast.pixels_mut() {
        let value = pixel[0] as f32;
        let new_value = ((value - 128.0) * 1.5 + 128.0).clamp(0.0, 255.0) as u8;
        pixel[0] = new_value;
    }
    
    // 画像をPNGとしてエンコード
    let mut buf = Vec::new();
    contrast.write_to(&mut buf, ImageFormat::Png).unwrap();
    
    buf
}