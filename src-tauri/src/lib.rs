mod labels;
mod usage;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/// 프론트가 합성한 트레이 표시 이미지(PNG)를 적용한다. None이면 기본 템플릿 아이콘으로 복귀.
#[tauri::command]
fn set_tray_display(app: tauri::AppHandle, png: Option<Vec<u8>>) -> Result<(), String> {
    let tray = app
        .tray_by_id("main-tray")
        .ok_or_else(|| "tray not found".to_string())?;

    let image = match &png {
        Some(bytes) => tauri::image::Image::from_bytes(bytes).map_err(|e| e.to_string())?,
        None => tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))
            .map_err(|e| e.to_string())?,
    };

    tray.set_icon(Some(image)).map_err(|e| e.to_string())?;
    tray.set_icon_as_template(true).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            usage::get_antigravity_usage,
            usage::get_claude_usage,
            usage::get_codex_usage,
            set_tray_display
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", labels::SHOW_APP, true, None::<&str>)?;
            let refresh_item =
                MenuItem::with_id(app, "refresh", labels::REFRESH_USAGE, true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", labels::QUIT, true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &refresh_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip(labels::TRAY_TOOLTIP)
                .icon(tauri::image::Image::from_bytes(include_bytes!(
                    "../icons/tray-template.png"
                ))?)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "refresh" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("usage-refresh-requested", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();

                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
