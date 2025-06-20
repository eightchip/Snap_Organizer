// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod search_engine;

use search_engine::{SearchEngine, SearchableItem, SearchQuery, SearchResult};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

// グローバルな検索エンジンインスタンス
struct SearchEngineState(Mutex<Option<SearchEngine>>);

#[tauri::command]
async fn init_search_engine(
    app_handle: tauri::AppHandle,
    state: State<'_, SearchEngineState>,
) -> Result<(), String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("App data directory not found")?;
    
    let index_path = app_dir.join("search_index");
    std::fs::create_dir_all(&index_path).map_err(|e| e.to_string())?;
    
    let search_engine = SearchEngine::new(&index_path).map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = Some(search_engine);
    
    Ok(())
}

#[tauri::command]
async fn add_item_to_index(
    item: SearchableItem,
    state: State<'_, SearchEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap();
    let search_engine = engine.as_mut().ok_or("Search engine not initialized")?;
    
    search_engine.add_item(item).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn update_item_in_index(
    item: SearchableItem,
    state: State<'_, SearchEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap();
    let search_engine = engine.as_mut().ok_or("Search engine not initialized")?;
    
    search_engine.update_item(item).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_item_from_index(
    item_id: String,
    state: State<'_, SearchEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap();
    let search_engine = engine.as_mut().ok_or("Search engine not initialized")?;
    
    search_engine.delete_item(&item_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn search_items(
    query: SearchQuery,
    state: State<'_, SearchEngineState>,
) -> Result<Vec<SearchResult>, String> {
    let engine = state.0.lock().unwrap();
    let search_engine = engine.as_ref().ok_or("Search engine not initialized")?;
    
    search_engine.search(query).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_search_index(
    state: State<'_, SearchEngineState>,
) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap();
    let search_engine = engine.as_mut().ok_or("Search engine not initialized")?;
    
    search_engine.clear_index().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_search_stats(
    state: State<'_, SearchEngineState>,
) -> Result<HashMap<String, usize>, String> {
    let engine = state.0.lock().unwrap();
    let search_engine = engine.as_ref().ok_or("Search engine not initialized")?;
    
    search_engine.get_stats().map_err(|e| e.to_string())
}

// 既存のコマンド（画像リサイズなど）
#[tauri::command]
async fn resize_image(
    image_data: Vec<u8>,
    max_width: u32,
    max_height: u32,
) -> Result<Vec<u8>, String> {
    use image::{DynamicImage, GenericImageView};
    
    let img = image::load_from_memory(&image_data)
        .map_err(|e| format!("Failed to load image: {}", e))?;
    
    let (width, height) = img.dimensions();
    
    // アスペクト比を保持してリサイズ
    let (new_width, new_height) = if width > height {
        let ratio = max_width as f32 / width as f32;
        (max_width, (height as f32 * ratio) as u32)
    } else {
        let ratio = max_height as f32 / height as f32;
        ((width as f32 * ratio) as u32, max_height)
    };
    
    let resized = img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);
    
    let mut output = Vec::new();
    resized
        .write_to(&mut std::io::Cursor::new(&mut output), image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode image: {}", e))?;
    
    Ok(output)
}

fn main() {
    tauri::Builder::default()
        .manage(SearchEngineState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            init_search_engine,
            add_item_to_index,
            update_item_in_index,
            delete_item_from_index,
            search_items,
            clear_search_index,
            get_search_stats,
            resize_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
