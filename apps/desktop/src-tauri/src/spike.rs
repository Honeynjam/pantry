//! Debug-only evidence hooks for the M2 Tauri auth spike (docs/spikes/tauri-auth.md). Compiled out
//! of release builds; M5 can delete this file.
//!
//! - `spike_report`: the web side prints its auth state here, so a terminal run shows it.
//! - `PANTRY_SPIKE_EMAIL` + `PANTRY_SPIKE_PASSWORD`: fill in and submit the sign-in form once it shows.
//! - `PANTRY_SPIKE_SNAPSHOT=/path.png`: `spike_snapshot` writes a PNG of the webview (WKWebView's own
//!   snapshot, so no Screen Recording permission is needed); `PANTRY_SPIKE_EXIT=1` then quits.

use std::env;
use tauri::webview::{PageLoadEvent, PageLoadPayload};
use tauri::{AppHandle, Runtime, Webview, WebviewWindow};

#[tauri::command]
pub fn spike_report(message: String) {
    println!("[pantry-spike] {message}");
}

/// Types the credentials into the shared sign-in screen and submits it, as a person would.
const SIGN_IN_SCRIPT: &str = r#"(() => {
  const credentials = __CREDENTIALS__;
  const timer = setInterval(() => {
    const email = document.getElementById("sign-in-email");
    const password = document.getElementById("sign-in-password");
    if (!email || !password) return;
    clearInterval(timer);
    email.value = credentials.email;
    password.value = credentials.password;
    email.form.requestSubmit();
  }, 250);
  setTimeout(() => clearInterval(timer), 30000);
})();"#;

pub fn on_page_load<R: Runtime>(webview: &Webview<R>, payload: &PageLoadPayload<'_>) {
    if payload.event() != PageLoadEvent::Finished {
        return;
    }
    let (Ok(email), Ok(password)) = (env::var("PANTRY_SPIKE_EMAIL"), env::var("PANTRY_SPIKE_PASSWORD")) else {
        return;
    };
    let credentials = serde_json::json!({ "email": email, "password": password }).to_string();
    println!("[pantry-spike] auto sign-in armed for {email}");
    if let Err(error) = webview.eval(SIGN_IN_SCRIPT.replace("__CREDENTIALS__", &credentials)) {
        eprintln!("[pantry-spike] eval failed: {error}");
    }
}

#[tauri::command]
pub fn spike_snapshot<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) -> Result<(), String> {
    let Ok(path) = env::var("PANTRY_SPIKE_SNAPSHOT") else {
        return Ok(());
    };
    let exit = env::var("PANTRY_SPIKE_EXIT").is_ok_and(|value| value == "1");
    let done = move || {
        if exit {
            app.exit(0);
        }
    };
    window
        .with_webview(move |webview| {
            #[cfg(target_os = "macos")]
            // SAFETY: on macOS `inner()` is the window's live WKWebView, and with_webview runs this
            // closure on the main thread.
            unsafe {
                macos::snapshot(webview.inner(), path, done)
            };
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (webview, path);
                eprintln!("[pantry-spike] snapshots are macOS only");
                done();
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
mod macos {
    use block2::RcBlock;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::WKWebView;
    use std::ffi::c_void;

    pub unsafe fn snapshot(webview: *mut c_void, path: String, done: impl Fn() + 'static) {
        let webview = &*(webview as *const WKWebView);
        let handler = RcBlock::new(move |image: *mut NSImage, _error: *mut NSError| {
            match write_png(image, &path) {
                Ok(()) => println!("[pantry-spike] snapshot written to {path}"),
                Err(error) => eprintln!("[pantry-spike] snapshot failed: {error}"),
            }
            done();
        });
        webview.takeSnapshotWithConfiguration_completionHandler(None, &handler);
    }

    unsafe fn write_png(image: *mut NSImage, path: &str) -> Result<(), String> {
        let image = image.as_ref().ok_or("WebKit returned no image")?;
        let tiff = image.TIFFRepresentation().ok_or("no TIFF data")?;
        let bitmap = NSBitmapImageRep::imageRepWithData(&tiff).ok_or("no bitmap")?;
        let png = bitmap
            .representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new())
            .ok_or("no PNG data")?;
        std::fs::write(path, png.to_vec()).map_err(|error| error.to_string())
    }
}
