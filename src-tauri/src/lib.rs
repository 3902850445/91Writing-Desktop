use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
    pub data_dir: String,
}

/// Get application information
#[tauri::command]
fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    log::info!("[get_app_info] Called");
    
    let platform = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "ios") {
        "ios"
    } else {
        log::warn!("[get_app_info] Unknown platform detected");
        "unknown"
    };

    log::debug!("[get_app_info] Platform: {}", platform);
    
    let data_dir = match app.path().app_data_dir() {
        Ok(dir) => {
            let dir_str = dir.to_string_lossy().to_string();
            log::info!("[get_app_info] Data dir: {}", dir_str);
            dir_str
        }
        Err(e) => {
            log::warn!("[get_app_info] Failed to get app data dir: {}, using fallback", e);
            ".".to_string()
        }
    };

    let version = app.package_info().version.to_string();
    log::info!("[get_app_info] App version: {}", version);
    
    let info = AppInfo {
        version,
        platform: platform.to_string(),
        data_dir,
    };
    
    log::info!("[get_app_info] Completed successfully");
    info
}

/// Save text content to a file
#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    log::info!("[save_file] Called with path: {}, content_length: {}", path, content.len());
    
    let path = PathBuf::from(&path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = path.parent() {
        log::debug!("[save_file] Creating parent directory: {}", parent.display());
        match std::fs::create_dir_all(parent) {
            Ok(()) => log::info!("[save_file] Parent directory ready"),
            Err(e) => {
                log::error!("[save_file] Failed to create parent directory: {}", e);
                return Err(format!("Failed to create parent directory: {}", e));
            }
        }
    }
    
    // Write file
    log::debug!("[save_file] Writing file...");
    match std::fs::write(&path, content) {
        Ok(()) => {
            log::info!("[save_file] File saved successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("[save_file] Failed to write file: {}", e);
            Err(format!("Failed to write file: {}", e))
        }
    }
}

/// Read text file content
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    log::info!("[read_file] Called with path: {}", path);
    
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            log::info!("[read_file] File read successfully, content_length: {}", content.len());
            Ok(content)
        }
        Err(e) => {
            log::error!("[read_file] Failed to read file: {}", e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

/// Get app data directory
#[tauri::command]
fn get_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    log::info!("[get_data_dir] Called");
    
    match app.path().app_data_dir() {
        Ok(dir) => {
            let dir_str = dir.to_string_lossy().to_string();
            log::info!("[get_data_dir] Data directory: {}", dir_str);
            Ok(dir_str)
        }
        Err(e) => {
            log::error!("[get_data_dir] Failed to get data directory: {}", e);
            Err(format!("Failed to get data directory: {}", e))
        }
    }
}

/// Log message from frontend
#[tauri::command]
fn log_message(level: String, category: String, message: String, details: serde_json::Value, timestamp: String) {
    log::info!("[{}] {}: {} (details: {})", level, category, message, details);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("[91Writing] Application starting...");
    
    // The log level must be decided at registration time. Registering
    // tauri-plugin-log a second time is a hard failure: the Rust logging
    // facade only accepts `set_boxed_logger` once per process, so the
    // duplicate registration errors out and takes the whole app down.
    let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log_level)
            .build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            log::info!("[91Writing] Application setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            save_file,
            read_file,
            get_data_dir,
            log_message
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            // Panicking here surfaces as an instant crash on Android, so
            // report the real reason through the log instead.
            log::error!("[91Writing] failed to start: {e}");
            std::process::exit(1);
        });

    log::info!("[91Writing] Application shutdown");
}
