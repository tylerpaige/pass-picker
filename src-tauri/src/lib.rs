use std::process::Command;

/// Build a PATH that includes common locations for Homebrew and MacPorts
/// binaries. macOS .app bundles launch with a minimal PATH that excludes
/// these, so `pass`, `gpg`, etc. won't be found otherwise.
fn shell_path() -> String {
    let base = std::env::var("PATH").unwrap_or_default();
    let extras = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/usr/local/MacGPG2/bin",
    ];
    let mut parts: Vec<&str> = extras.to_vec();
    for p in base.split(':') {
        if !parts.contains(&p) {
            parts.push(p);
        }
    }
    parts.join(":")
}

fn pass_command() -> Command {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut cmd = Command::new("pass");
    cmd.env("PATH", shell_path());
    cmd.env("HOME", &home);
    cmd.env("GNUPGHOME", std::env::var("GNUPGHOME")
        .unwrap_or_else(|_| format!("{}/.gnupg", home)));
    cmd
}

fn git_command() -> Command {
    let store_dir = password_store_dir();
    let mut cmd = Command::new("git");
    cmd.env("PATH", shell_path());
    cmd.current_dir(store_dir);
    cmd
}

fn password_store_dir() -> String {
    std::env::var("PASSWORD_STORE_DIR")
        .unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_default();
            format!("{}/.password-store", home)
        })
}

#[tauri::command]
fn list_entries() -> Result<Vec<String>, String> {
    let store_dir = password_store_dir();
    let output = Command::new("find")
        .args([&store_dir, "-name", "*.gpg", "-type", "f", "-not", "-path", "*/.git/*"])
        .output()
        .map_err(|e| format!("Failed to list entries: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let prefix = format!("{}/", store_dir);
    let entries: Vec<String> = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            line.trim()
                .strip_prefix(&prefix)
                .unwrap_or(line.trim())
                .strip_suffix(".gpg")
                .unwrap_or(line.trim())
                .to_string()
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
fn get_entry(name: String) -> Result<String, String> {
    let output = pass_command()
        .arg("show")
        .arg(&name)
        .output()
        .map_err(|e| format!("Failed to get entry: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn get_otp(name: String) -> Result<String, String> {
    let output = pass_command()
        .args(["otp", &name])
        .output()
        .map_err(|e| format!("Failed to get OTP: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn insert_entry(name: String, content: String) -> Result<(), String> {
    let output = pass_command()
        .args(["insert", "-m", &name])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn pass: {}", e))?;

    use std::io::Write;
    let mut child = output;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write to pass stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for pass: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn edit_entry(name: String, content: String) -> Result<(), String> {
    let mut child = pass_command()
        .args(["insert", "-m", "-f", &name])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn pass: {}", e))?;

    use std::io::Write;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write to pass stdin: {}", e))?;
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for pass: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn delete_entry(name: String) -> Result<(), String> {
    let output = pass_command()
        .args(["rm", "-f", &name])
        .output()
        .map_err(|e| format!("Failed to delete entry: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn generate_password(name: String, length: u32) -> Result<String, String> {
    let output = pass_command()
        .args(["generate", "-f", &name, &length.to_string()])
        .output()
        .map_err(|e| format!("Failed to generate password: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn rename_entry(old_name: String, new_name: String) -> Result<(), String> {
    let output = pass_command()
        .args(["mv", "-f", &old_name, &new_name])
        .output()
        .map_err(|e| format!("Failed to rename entry: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

#[tauri::command]
fn git_pull() -> Result<(), String> {
    let output = git_command()
        .args(["pull", "--rebase"])
        .output()
        .map_err(|e| format!("Failed to git pull: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
fn git_push() -> Result<(), String> {
    let output = git_command()
        .args(["push"])
        .output()
        .map_err(|e| format!("Failed to git push: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            list_entries,
            get_entry,
            get_otp,
            insert_entry,
            edit_entry,
            delete_entry,
            rename_entry,
            generate_password,
            git_pull,
            git_push,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
