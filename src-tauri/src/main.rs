// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use image::io::Reader as ImageReader;
use image::ImageOutputFormat;
use std::io::Cursor;

#[command]
fn resize_image(base64_input: String, width: u32, height: u32) -> Result<String, String> {
    // base64デコード
    let img_data = base64::decode(&base64_input).map_err(|e| e.to_string())?;
    let img = ImageReader::new(Cursor::new(img_data))
        .with_guessed_format()
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;

    // リサイズ
    let resized = img.resize(width, height, image::imageops::FilterType::Lanczos3);

    // PNGでエンコード
    let mut buf = Vec::new();
    resized.write_to(&mut Cursor::new(&mut buf), ImageOutputFormat::Png)
        .map_err(|e| e.to_string())?;

    // base64エンコードして返す
    Ok(base64::encode(&buf))
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![resize_image])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
